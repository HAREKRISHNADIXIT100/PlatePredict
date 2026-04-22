-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "hostel_id" TEXT NOT NULL,
    "advance_paid" REAL NOT NULL DEFAULT 15000,
    "current_balance" REAL NOT NULL DEFAULT 15000,
    "fee_due_status" BOOLEAN NOT NULL DEFAULT false,
    "amount_due" REAL NOT NULL DEFAULT 0.00,
    "reward_points" REAL NOT NULL DEFAULT 0.00,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("advance_paid", "amount_due", "created_at", "current_balance", "email", "fee_due_status", "hostel_id", "id", "name", "password_hash", "reward_points", "role") SELECT "advance_paid", "amount_due", "created_at", "current_balance", "email", "fee_due_status", "hostel_id", "id", "name", "password_hash", "reward_points", "role" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
