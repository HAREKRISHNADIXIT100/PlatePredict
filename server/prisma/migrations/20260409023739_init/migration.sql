-- CreateTable
CREATE TABLE "users" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "otp_code" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meal_date" DATETIME NOT NULL,
    "meal_type" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "serve_time" DATETIME NOT NULL,
    "poll_cutoff_time" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "intention" TEXT NOT NULL,
    "voted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "polls_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "polls_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "snack_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "token_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "redeemed_at" DATETIME,
    CONSTRAINT "snack_tokens_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "snack_tokens_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meal_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deduction_amount" REAL NOT NULL,
    CONSTRAINT "meal_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "meal_attendance_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "gateway_ref_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "polls_student_id_menu_id_key" ON "polls"("student_id", "menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "snack_tokens_poll_id_key" ON "snack_tokens"("poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "snack_tokens_token_code_key" ON "snack_tokens"("token_code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_gateway_ref_id_key" ON "transactions"("gateway_ref_id");
