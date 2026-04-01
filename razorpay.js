// src/config/razorpay.js
// Razorpay SDK singleton — used by student.routes.js for order creation
// and webhook.routes.js for signature verification.

const Razorpay = require("razorpay");

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    "[RAZORPAY] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in env. " +
      "Payment features will fail at runtime."
  );
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpayInstance;
