// src/routes/auth.routes.js
// Implements: POST /auth/register, /auth/verify-otp, /auth/login
// Matches API.md sections 2.1, 2.2, 2.3

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const prisma = require("../config/prisma");
const { sendOtpEmail } = require("../utils/email.util");
const {
  checkEmailDomain,
  validateRegister,
  validateVerifyOtp,
  validateLogin,
  handleValidationErrors,
} = require("../middleware/domain.middleware");

// ─── 2.1 Register (Trigger OTP) ───────────────────────────────────────────────
// POST /api/v1/auth/register
router.post(
  "/register",
  validateRegister,
  handleValidationErrors,
  checkEmailDomain,
  async (req, res, next) => {
    try {
      const { name, email, hostel_id } = req.body;

      // Block duplicate accounts
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      // Generate secure 6-digit OTP
      const otp_code = String(crypto.randomInt(100000, 999999));
      const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
      const expires_at = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Invalidate any previous unused OTPs for this email
      await prisma.verificationCode.updateMany({
        where: { email, is_used: false },
        data: { is_used: true },
      });

      // Store OTP
      await prisma.verificationCode.create({
        data: { email, otp_code, expires_at },
      });

      // Store pending user data in OTP record metadata OR temporarily in a cache.
      // For simplicity, we persist name + hostel_id in a separate staging mechanism.
      // Here we embed them in a signed short-lived JWT so we don't need a temp table.
      // The OTP verify step will use this to create the user.
      const pendingToken = jwt.sign(
        { name, email, hostel_id },
        process.env.JWT_SECRET,
        { expiresIn: `${expiryMinutes}m` }
      );

      // Send OTP via email
      await sendOtpEmail(email, otp_code, name);

      // In production, NEVER return the OTP in the response.
      // pendingToken is returned so the verify-otp step can receive user context.
      res.status(202).json({
        message: "OTP sent to email.",
        pending_token: pendingToken, // client stores this temporarily
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── 2.2 Verify OTP & Set Password ───────────────────────────────────────────
// POST /api/v1/auth/verify-otp
router.post(
  "/verify-otp",
  validateVerifyOtp,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, otp_code, password, pending_token } = req.body;

      // Validate OTP
      const record = await prisma.verificationCode.findFirst({
        where: {
          email,
          otp_code,
          is_used: false,
          expires_at: { gt: new Date() },
        },
        orderBy: { expires_at: "desc" },
      });

      if (!record) {
        return res
          .status(400)
          .json({ error: "Invalid or expired OTP. Please request a new one." });
      }

      // Decode pending registration context
      let registrationData;
      try {
        registrationData = jwt.verify(pending_token, process.env.JWT_SECRET);
      } catch {
        return res.status(400).json({
          error: "Registration session expired. Please start over.",
        });
      }

      if (registrationData.email !== email) {
        return res.status(400).json({ error: "Email mismatch in registration session." });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Create user + invalidate OTP in a transaction
      const user = await prisma.$transaction(async (tx) => {
        await tx.verificationCode.update({
          where: { id: record.id },
          data: { is_used: true },
        });

        return tx.user.create({
          data: {
            name: registrationData.name,
            email,
            password_hash,
            hostel_id: registrationData.hostel_id,
            role: "STUDENT",
          },
        });
      });

      res.status(201).json({
        message: "Account created successfully.",
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── 2.3 Login ────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
router.post(
  "/login",
  validateLogin,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Use timing-safe comparison to prevent user enumeration
      const dummyHash = "$2b$12$invalidhashfortimingsafety000000000000000000000";
      const isValid = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, dummyHash);

      if (!user || !isValid) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      // Sign JWT
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          fee_due_status: user.fee_due_status,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
