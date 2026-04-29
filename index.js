// src/index.js — Express server entry point
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./auth.routes");
const studentRoutes = require("./student.routes");
const managerRoutes = require("./manager.routes");
const webhookRoutes = require("./webhook.routes");
const { startAllCronJobs } = require("./token_expiry");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter for auth routes
  message: { error: "Too many auth attempts. Please wait 15 minutes." },
});

app.use(globalLimiter);

// ─── Body Parser ──────────────────────────────────────────────────────────────
// NOTE: /webhook/* must use raw body for Razorpay signature verification.
// express.raw() keeps req.body as a Buffer so the HMAC can be computed
// over the exact bytes Razorpay signed.
app.use("/api/v1/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/manager", managerRoutes);
app.use("/api/v1/webhook", webhookRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Root route taaki main URL khali na dikhe
app.get("/", (req, res) => {
  res.send("PlatePredict API is live! Use /health to check status.");
});


// ─── 404 Catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : err.message,
  });
});

const PORT = process.env.PORT || 10000; // Render usually uses 10000

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 Environment: ${process.env.NODE_ENV || "development"}`);

  // Start background cron jobs after the server is listening
  startAllCronJobs();
});
module.exports = app;
