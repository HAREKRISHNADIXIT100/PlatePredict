// src/middleware/domain.middleware.js
// Enforces college email domain restriction on registration (Feature spec 2)

const { body, validationResult } = require("express-validator");

/**
 * Checks that the email domain is in the ALLOWED_EMAIL_DOMAINS env list.
 * Example .env entry:  ALLOWED_EMAIL_DOMAINS="college.edu,hostel.college.edu"
 */
const checkEmailDomain = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "college.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase());

  const emailDomain = email.split("@")[1]?.toLowerCase();

  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return res.status(403).json({
      error: "Email domain not recognized or not in hostel directory.",
    });
  }

  next();
};

// ─── Request Validators ───────────────────────────────────────────────────────

const validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({ max: 100 })
    .withMessage("Name must be under 100 characters."),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("A valid email is required."),
  body("hostel_id")
    .trim()
    .notEmpty()
    .withMessage("Hostel ID is required."),
];

const validateVerifyOtp = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
  body("otp_code")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be a 6-digit number."),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter.")
    .matches(/\d/)
    .withMessage("Password must contain at least one number."),
];

const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
  body("password").notEmpty().withMessage("Password is required."),
];

// ─── Validation Result Handler ────────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = {
  checkEmailDomain,
  validateRegister,
  validateVerifyOtp,
  validateLogin,
  handleValidationErrors,
};
