// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../config/prisma");
const { sendOtpEmail } = require("../utils/email.util");
const { checkEmailDomain, validateRegister, validateVerifyOtp, validateLogin, handleValidationErrors } = require("../middleware/domain.middleware");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-me";

// POST /auth/register
router.post("/register", validateRegister, handleValidationErrors, checkEmailDomain, async (req, res, next) => {
  try {
    const { name, email, hostel_id } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const otp_code = String(crypto.randomInt(100000, 999999));
    const expiryMinutes = 10;
    const expires_at = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await prisma.verificationCode.updateMany({
      where: { email, is_used: false },
      data: { is_used: true },
    });

    await prisma.verificationCode.create({
      data: { email, otp_code, expires_at },
    });

    const pendingToken = jwt.sign({ name, email, hostel_id }, JWT_SECRET, { expiresIn: `${expiryMinutes}m` });

    await sendOtpEmail(email, otp_code, name);

    res.status(202).json({ message: "OTP sent to email.", pending_token: pendingToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-otp
router.post("/verify-otp", validateVerifyOtp, handleValidationErrors, async (req, res, next) => {
  try {
    const { email, otp_code, password, pending_token } = req.body;

    const record = await prisma.verificationCode.findFirst({
      where: { email, otp_code, is_used: false, expires_at: { gt: new Date() } },
      orderBy: { expires_at: "desc" },
    });

    if (!record) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    let registrationData;
    try {
      registrationData = jwt.verify(pending_token, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: "Registration session expired. Please start over." });
    }

    if (registrationData.email !== email) {
      return res.status(400).json({ error: "Email mismatch." });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({ where: { id: record.id }, data: { is_used: true } });
      return tx.user.create({
        data: { name: registrationData.name, email, password_hash, hostel_id: registrationData.hostel_id, role: "STUDENT" },
      });
    });

    res.status(201).json({ message: "Account created successfully.", user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", validateLogin, handleValidationErrors, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    const dummyHash = "$2b$12$invalidhashfortimingsafety000000000000000000000";
    const isValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, role: user.role, fee_due_status: user.fee_due_status },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
