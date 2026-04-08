// src/utils/email.util.js
const nodemailer = require("nodemailer");

// Create standard transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
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
  if (!isSmtpConfigured()) {
    console.log(`\n📧 [EMAIL STUB] OTP for ${name} (${email}): ${otpCode}\n`);
    return;
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
    // Fallback to log so dev flow isn't completely broken
    console.log(`\n📧 [EMAIL STUB FALLBACK] OTP for ${name} (${email}): ${otpCode}\n`);
  }
}

async function sendReminderEmail(email, name, amountDue) {
  if (!isSmtpConfigured()) {
    console.log(`\n📧 [EMAIL STUB] Reminder to ${name} (${email}): ₹${amountDue} due\n`);
    return;
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
  }
}

module.exports = { sendOtpEmail, sendReminderEmail };
