// src/utils/email.util.js
// Sends OTP emails via Nodemailer SMTP.
// Used by auth.routes.js during registration and by manager reminder flow.

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a 6-digit OTP to a student during registration.
 */
async function sendOtpEmail(email, otpCode, name) {
  const mailOptions = {
    from: `"PlatePredict" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Verification Code — PlatePredict",
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 12px;">
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Hello ${name},</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Use the code below to verify your college email and complete your PlatePredict account setup.
        </p>
        <div style="background: #1a1a2e; color: #fff; font-size: 32px; letter-spacing: 8px; text-align: center; padding: 18px; border-radius: 8px; margin: 24px 0; font-weight: 700;">
          ${otpCode}
        </div>
        <p style="color: #888; font-size: 13px;">
          This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send a payment reminder to a defaulting student.
 */
async function sendReminderEmail(email, name, amountDue) {
  const mailOptions = {
    from: `"PlatePredict" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Mess Fee Payment Reminder — PlatePredict",
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafafa; border-radius: 12px;">
        <h2 style="color: #1a1a2e; margin: 0 0 8px;">Hi ${name},</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          This is a friendly reminder that your mess advance fee of
          <strong style="color: #e74c3c;">₹${Number(amountDue).toLocaleString("en-IN")}</strong>
          is pending.
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Please log in to your PlatePredict dashboard and complete the payment to avoid any service interruptions.
        </p>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          — PlatePredict Mess Management
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendReminderEmail };
