// src/routes/webhook.routes.js
// Simplified for local dev — just processes payment success directly
const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");

router.post("/payment-success", async (req, res) => {
  try {
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    const payload = JSON.parse(rawBody.toString("utf-8"));
    const { order_id, status } = payload;

    if (status !== "SUCCESS") {
      return res.status(200).json({ status: "Acknowledged" });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { gateway_ref_id: order_id, status: "PENDING" },
    });

    if (!transaction) {
      return res.status(200).json({ status: "Acknowledged" });
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS" },
    });

    // Credit balance (no DB trigger in SQLite)
    await prisma.user.update({
      where: { id: transaction.student_id },
      data: {
        advance_paid: { increment: transaction.amount },
        current_balance: { increment: transaction.amount },
        fee_due_status: false,
        amount_due: 0,
      },
    });

    console.log(`[WEBHOOK] Payment SUCCESS: student ${transaction.student_id}, ₹${transaction.amount}`);
    res.status(200).json({ status: "Acknowledged" });
  } catch (err) {
    console.error("[WEBHOOK ERROR]", err.message);
    res.status(200).json({ status: "Acknowledged" });
  }
});

module.exports = router;
