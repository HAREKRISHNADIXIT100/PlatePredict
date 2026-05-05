// src/utils/email.util.js
// Sends OTP and reminder emails via Nodemailer SMTP.
// Errors are propagated so callers can return appropriate HTTP responses.

const nodemailer = require("nodemailer");

const isDev = () => process.env.NODE_ENV !== "production";

// Create standard transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: parseInt(process.env.SMTP_PORT) === 465 || !process.env.SMTP_PORT, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper to determine if SMTP looks configured
const isSmtpConfigured = () => {
  return process.env.SMTP_USER && process.env.SMTP_USER !== "your-email@gmail.com"
      && process.env.SMTP_PASS && process.env.SMTP_PASS !== "your-app-password";
};

async function sendOtpEmail(email, otpCode, name) {
  // In dev mode, always log OTP to console so testing works regardless of SMTP
  if (isDev()) {
    console.log(`\n📧 [DEV] OTP for ${name} (${email}): ${otpCode}\n`);
  }

  if (!isSmtpConfigured()) {
    if (isDev()) {
      console.warn("⚠️  SMTP not configured — OTP logged to console above. Email NOT sent.");
      return; // Allow dev flow to continue without real email
    }
    // In production, fail hard — email MUST be configured
    throw new Error("Email service is not configured. Please contact support.");
  }

  try {
    await transporter.sendMail({
      from: `"PlatePredict Registration" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your PlatePredict Registration OTP",
      text: `Hello ${name},\n\nYour OTP for registration is: ${otpCode}\nThis code will expire in 10 minutes.\n\nBest,\nThe PlatePredict Team`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #6f1d1b;">PlatePredict</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your one-time password for registration is:</p>
          <h1 style="font-size: 36px; letter-spacing: 4px; color: #333; text-align: center;">${otpCode}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`✅ [Nodemailer] Sent OTP to ${email}`);
  } catch (error) {
    console.error("❌ [Nodemailer Error] Failed to send OTP via SMTP:", error.message);
    if (isDev()) {
      console.warn("⚠️  Email delivery failed, but OTP was logged to console above. Continuing in dev mode.");
      return; // Don't block dev flow — OTP is already in console
    }
    // In production, propagate the error so the API returns a clear failure
    throw new Error("Failed to send verification email. Please try again later.");
  }
}

async function sendReminderEmail(email, name, amountDue) {
  if (!isSmtpConfigured()) {
    if (isDev()) {
      console.log(`\n📧 [DEV STUB] Reminder to ${name} (${email}): ₹${amountDue} due\n`);
      return;
    }
    throw new Error("Email service is not configured.");
  }

  try {
    await transporter.sendMail({
      from: `"PlatePredict Accounts" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Action Required: Mess Fee Due",
      text: `Hello ${name},\n\nThis is a reminder that you have pending mess fees of ₹${amountDue}. Please log in to your dashboard to complete the payment.\n\nBest,\nThe Mess Admin`,
    });
    console.log(`✅ [Nodemailer] Sent Reminder to ${email}`);
  } catch (error) {
    console.error("❌ [Nodemailer Error] Failed to send reminder:", error.message);
    // Propagate so the remind endpoint can report individual failures
    throw new Error(`Failed to send reminder to ${email}.`);
  }
}

module.exports = { sendOtpEmail, sendReminderEmail };
