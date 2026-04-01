// src/middleware/domain.middleware.js
const { body, validationResult } = require("express-validator");

const checkEmailDomain = (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "college.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase());

  const emailDomain = email.split("@")[1]?.toLowerCase();

  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return res.status(403).json({ error: "Email domain not recognized." });
  }
  next();
};

const validateRegister = [
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("email").isEmail().normalizeEmail().withMessage("A valid email is required."),
  body("hostel_id").trim().notEmpty().withMessage("Hostel ID is required."),
];

const validateVerifyOtp = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
  body("otp_code").isLength({ min: 6, max: 6 }).isNumeric().withMessage("OTP must be 6 digits."),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
];

const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
  body("password").notEmpty().withMessage("Password is required."),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
  }
  next();
};

module.exports = { checkEmailDomain, validateRegister, validateVerifyOtp, validateLogin, handleValidationErrors };
