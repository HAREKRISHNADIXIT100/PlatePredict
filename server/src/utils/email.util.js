// src/utils/email.util.js
// Stub for local development — logs OTP to console instead of sending email.

async function sendOtpEmail(email, otpCode, name) {
  console.log(`\n📧 [EMAIL STUB] OTP for ${name} (${email}): ${otpCode}\n`);
}

async function sendReminderEmail(email, name, amountDue) {
  console.log(`\n📧 [EMAIL STUB] Reminder to ${name} (${email}): ₹${amountDue} due\n`);
}

module.exports = { sendOtpEmail, sendReminderEmail };
