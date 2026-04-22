/*
  Warnings:

  - You are about to drop the `snack_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "snack_tokens_token_code_key";

-- DropIndex
DROP INDEX "snack_tokens_poll_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "snack_tokens";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "reward_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "points" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reward_logs_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meal_date" DATETIME NOT NULL,
    "meal_type" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "serve_time" DATETIME NOT NULL,
    "poll_cutoff_time" DATETIME NOT NULL,
    "rewards_processed" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_menus" ("id", "items", "meal_date", "meal_type", "poll_cutoff_time", "serve_time") SELECT "id", "items", "meal_date", "meal_type", "poll_cutoff_time", "serve_time" FROM "menus";
DROP TABLE "menus";
ALTER TABLE "new_menus" RENAME TO "menus";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "hostel_id" TEXT NOT NULL,
    "advance_paid" REAL NOT NULL DEFAULT 0.00,
    "current_balance" REAL NOT NULL DEFAULT 0.00,
    "fee_due_status" BOOLEAN NOT NULL DEFAULT false,
    "amount_due" REAL NOT NULL DEFAULT 0.00,
    "reward_points" REAL NOT NULL DEFAULT 0.00,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("advance_paid", "amount_due", "created_at", "current_balance", "email", "fee_due_status", "hostel_id", "id", "name", "password_hash", "role") SELECT "advance_paid", "amount_due", "created_at", "current_balance", "email", "fee_due_status", "hostel_id", "id", "name", "password_hash", "role" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
