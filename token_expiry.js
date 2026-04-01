// src/cron/token_expiry.js
// Background job: Expire snack tokens whose meal window has passed.
//
// Runs every 30 minutes. Finds all ISSUED tokens whose associated meal's
// serve_time + 2 hours has elapsed (meaning the meal window is over and
// the student can no longer redeem their snack token).
//
// Also refreshes the AI materialized view nightly at 2 AM so the manager's
// prediction endpoint uses fresh historical data.

const cron = require("node-cron");
const prisma = require("../config/prisma");

// ─── Token Expiry ─────────────────────────────────────────────────────────────
// Runs at :00 and :30 of every hour
const TOKEN_EXPIRY_WINDOW_HOURS = 2;

function startTokenExpiryCron() {
  cron.schedule("0,30 * * * *", async () => {
    try {
      const cutoff = new Date(
        Date.now() - TOKEN_EXPIRY_WINDOW_HOURS * 60 * 60 * 1000
      );

      // Find all ISSUED tokens linked to meals that ended before the cutoff
      const result = await prisma.snackToken.updateMany({
        where: {
          status: "ISSUED",
          poll: {
            menu: {
              serve_time: { lt: cutoff },
            },
          },
        },
        data: { status: "EXPIRED" },
      });

      if (result.count > 0) {
        console.log(
          `[CRON:TOKEN_EXPIRY] Expired ${result.count} snack token(s).`
        );
      }
    } catch (err) {
      console.error("[CRON:TOKEN_EXPIRY] Error:", err.message);
    }
  });

  console.log("⏰ Token expiry cron started (every 30 min).");
}

// ─── AI Materialized View Refresh ─────────────────────────────────────────────
// Runs at 2:00 AM every day. The materialized view `ai_training_data` (defined
// in 001_ai_views_triggers.sql) pre-computes deviation percentages for all
// past meals so the /manager/ai/predict endpoint can query it instantly.
function startAiViewRefreshCron() {
  cron.schedule("0 2 * * *", async () => {
    try {
      await prisma.$executeRawUnsafe(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY ai_training_data"
      );
      console.log("[CRON:AI_REFRESH] Materialized view refreshed.");
    } catch (err) {
      console.error("[CRON:AI_REFRESH] Error:", err.message);
    }
  });

  console.log("⏰ AI materialized view refresh cron started (daily at 2 AM).");
}

// ─── Export ───────────────────────────────────────────────────────────────────
function startAllCronJobs() {
  startTokenExpiryCron();
  startAiViewRefreshCron();
}

module.exports = { startAllCronJobs };
