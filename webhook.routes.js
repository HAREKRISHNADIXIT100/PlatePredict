// src/routes/webhook.routes.js
// POST /api/v1/webhook/payment-success
// Receives server-to-server confirmation from Razorpay (API.md 3.4)
//
// IMPORTANT: index.js mounts this under express.raw() so req.body is a Buffer.
// This is required because Razorpay computes the HMAC signature over the raw
// request body. Parsing it as JSON first would change whitespace/ordering and
// break verification.
//
// Flow:
//   1. Verify HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET.
//   2. Parse the raw body into JSON.
//   3. If status != SUCCESS, acknowledge without action.
//   4. Find the PENDING transaction by order_id.
//   5. Update transaction to SUCCESS — the PostgreSQL trigger
//      `trg_credit_payment` automatically handles balance crediting.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const prisma = require("../config/prisma");

router.post("/payment-success", async (req, res, next) => {
  try {
    // ── 1. Verify Razorpay webhook signature ─────────────────────────────────
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    if (!webhookSecret) {
      console.error(
        "[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set. " +
          "Cannot verify webhook authenticity."
      );
      return res.status(500).json({ error: "Server misconfiguration." });
    }

    if (!receivedSignature) {
      console.warn("[WEBHOOK] Missing x-razorpay-signature header.");
      return res.status(400).json({ error: "Missing signature." });
    }

    // req.body is a Buffer because index.js applies express.raw() on /webhook/*
    const rawBody =
      req.body instanceof Buffer ? req.body : Buffer.from(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(receivedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      console.warn("[WEBHOOK] Invalid Razorpay signature — request rejected.");
      return res.status(400).json({ error: "Invalid signature." });
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    const payload = JSON.parse(rawBody.toString("utf-8"));
    const { gateway_transaction_id, order_id, status } = payload;

    if (status !== "SUCCESS") {
      // Log but acknowledge non-success events without action
      console.log(`[WEBHOOK] Non-success payment event: ${status}`);
      return res.status(200).json({ status: "Acknowledged" });
    }

    // ── 3. Find the PENDING transaction by order_id ───────────────────────────
    // order_id was stored as gateway_ref_id when the student initiated payment
    const transaction = await prisma.transaction.findFirst({
      where: { gateway_ref_id: order_id, status: "PENDING" },
    });

    if (!transaction) {
      // Idempotency: already processed or never existed
      console.log(
        `[WEBHOOK] Transaction for order ${order_id} not found or already processed.`
      );
      return res.status(200).json({ status: "Acknowledged" });
    }

    // ── 4. Mark transaction SUCCESS ───────────────────────────────────────────
    // Update the gateway_ref_id to the final transaction ID from Razorpay
    // and flip status to SUCCESS.
    //
    // The PostgreSQL trigger `trg_credit_payment` (in 001_ai_views_triggers.sql)
    // fires on this UPDATE and automatically:
    //   • Increments users.advance_paid by transaction.amount
    //   • Increments users.current_balance by transaction.amount
    //   • Sets fee_due_status = FALSE
    //   • Sets amount_due = 0
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESS",
        gateway_ref_id: gateway_transaction_id || order_id,
      },
    });

    console.log(
      `[WEBHOOK] Payment SUCCESS for student ${transaction.student_id}, ` +
        `amount ₹${transaction.amount}`
    );

    res.status(200).json({ status: "Acknowledged" });
  } catch (err) {
    // Always return 200 to Razorpay to prevent infinite retries for
    // non-retryable errors (e.g., JSON parse failure, DB constraint).
    console.error("[WEBHOOK ERROR]", err.message);
    res.status(200).json({ status: "Acknowledged" });
  }
});

module.exports = router;
