// src/index.js — Express server entry point
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/student.routes");
const managerRoutes = require("./routes/manager.routes");
const webhookRoutes = require("./routes/webhook.routes");
const { startAllCronJobs } = require("./cron/token_expiry");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Webhook needs raw body
app.use("/api/v1/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/manager", managerRoutes);
app.use("/api/v1/webhook", webhookRoutes);

// Health
app.get("/health", (req, res) => res.json({ status: "ok" }));

// 404
app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));

// Error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  startAllCronJobs();
});

module.exports = app;
