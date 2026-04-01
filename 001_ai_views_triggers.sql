-- ================================================================
-- Migration: Initial Schema + AI Materialized View
-- Mess Management & AI Optimization App
-- Run AFTER prisma migrate dev generates the base tables
-- ================================================================

-- ----------------------------------------------------------------
-- Performance Indexes (beyond what Prisma generates from @@index)
-- ----------------------------------------------------------------

-- Fast aggregate Yes/No counts for manager dashboard
CREATE INDEX IF NOT EXISTS idx_polls_menu_intention
  ON polls (menu_id, intention);

-- Instant token lookup at snack counter
CREATE INDEX IF NOT EXISTS idx_snack_tokens_code_status
  ON snack_tokens (token_code, status);

-- Quick defaulter list generation
CREATE INDEX IF NOT EXISTS idx_users_hostel_fee_due
  ON users (hostel_id, fee_due_status);

-- ----------------------------------------------------------------
-- 3.2 Materialized View for AI Training Data
-- Provides a flat, pre-computed dataset for the deviation model.
-- Refresh on a schedule (e.g., nightly cron): 
--   REFRESH MATERIALIZED VIEW CONCURRENTLY ai_training_data;
-- ----------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS ai_training_data AS
SELECT
  m.id                                              AS menu_id,
  m.meal_date,
  m.meal_type,
  TRIM(TO_CHAR(m.meal_date, 'Day'))                 AS day_of_week,
  m.items                                           AS menu_items,

  -- Count of students who said YES
  COUNT(p.id) FILTER (WHERE p.intention = 'YES')    AS total_yes_votes,

  -- Count of students who actually showed up
  COUNT(DISTINCT ma.student_id)                     AS actual_attendance,

  -- Deviation percentage: how many "Yes" voters didn't show
  CASE
    WHEN COUNT(p.id) FILTER (WHERE p.intention = 'YES') = 0 THEN 0
    ELSE ROUND(
      (
        (COUNT(p.id) FILTER (WHERE p.intention = 'YES') - COUNT(DISTINCT ma.student_id))::DECIMAL
        / COUNT(p.id) FILTER (WHERE p.intention = 'YES')
      ) * 100,
      2
    )
  END                                               AS deviation_percentage

FROM menus m
LEFT JOIN polls p
  ON p.menu_id = m.id
LEFT JOIN meal_attendance ma
  ON ma.menu_id = m.id

-- Only include completed meals (past meals have full data)
WHERE m.serve_time < NOW()

GROUP BY
  m.id,
  m.meal_date,
  m.meal_type,
  m.items

ORDER BY m.meal_date DESC, m.meal_type;

-- Index on the materialized view for fast AI model queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_training_menu_id
  ON ai_training_data (menu_id);

CREATE INDEX IF NOT EXISTS idx_ai_training_meal_type_day
  ON ai_training_data (meal_type, day_of_week);

-- ----------------------------------------------------------------
-- Helper function: Auto-compute poll_cutoff_time
-- Ensures poll_cutoff_time is always exactly 4 hours before serve_time
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_poll_cutoff_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.poll_cutoff_time := NEW.serve_time - INTERVAL '4 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_poll_cutoff
BEFORE INSERT OR UPDATE OF serve_time
ON menus
FOR EACH ROW
EXECUTE FUNCTION set_poll_cutoff_time();

-- ----------------------------------------------------------------
-- Helper function: Auto-update current_balance on meal_attendance insert
-- Deducts the meal cost from the student's balance in real-time
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION deduct_meal_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET current_balance = current_balance - NEW.deduction_amount
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_meal_balance
AFTER INSERT ON meal_attendance
FOR EACH ROW
EXECUTE FUNCTION deduct_meal_balance();

-- ----------------------------------------------------------------
-- Helper function: Credit balance and clear fee_due on payment success
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION credit_payment_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act on status transitioning to SUCCESS
  IF NEW.status = 'SUCCESS' AND OLD.status != 'SUCCESS' THEN
    UPDATE users
    SET
      advance_paid     = advance_paid + NEW.amount,
      current_balance  = current_balance + NEW.amount,
      fee_due_status   = FALSE,
      amount_due       = 0.00
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_payment
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION credit_payment_balance();
