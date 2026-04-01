// src/routes/student.routes.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const prisma = require("../config/prisma");
const { authenticate, requireStudent } = require("../middleware/auth.middleware");
const crypto = require("crypto");

router.use(authenticate, requireStudent);

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try { return JSON.parse(items); } catch { return []; }
}

async function isPollLocked(menu) {
  const now = new Date();
  if (now >= new Date(menu.poll_cutoff_time)) return true;

  if (menu.meal_type === "BREAKFAST") {
    const mealDate = new Date(menu.meal_date);
    const prevDay = new Date(mealDate);
    prevDay.setDate(prevDay.getDate() - 1);
    prevDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(prevDay.getTime() + 86400000);

    const previousDinner = await prisma.menu.findFirst({
      where: { meal_type: "DINNER", meal_date: { gte: prevDay, lt: nextDay } },
      select: { serve_time: true },
    });

    if (previousDinner) {
      const dinnerConclusion = new Date(new Date(previousDinner.serve_time).getTime() + 2 * 60 * 60 * 1000);
      if (now < dinnerConclusion) return true;
    }
  }
  return false;
}

// GET /student/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, hostel_id: true, advance_paid: true, current_balance: true, fee_due_status: true, amount_due: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const menus = await prisma.menu.findMany({
      where: { meal_date: { gte: today, lt: tomorrow } },
      orderBy: { serve_time: "asc" },
      include: {
        polls: {
          where: { student_id: studentId },
          select: { intention: true, snack_token: { select: { token_code: true, status: true } } },
        },
      },
    });

    const today_menu = await Promise.all(
      menus.map(async (menu) => {
        const locked = await isPollLocked(menu);
        const studentPoll = menu.polls[0] || null;
        return {
          menu_id: menu.id,
          meal_type: menu.meal_type,
          items: parseItems(menu.items),
          serve_time: menu.serve_time,
          poll_cutoff_time: menu.poll_cutoff_time,
          poll_locked: locked,
          student_voted: !!studentPoll,
          student_intention: studentPoll?.intention || null,
          snack_token: studentPoll?.snack_token || null,
        };
      })
    );

    const mealsConsumed = await prisma.mealAttendance.count({ where: { student_id: studentId } });

    res.json({
      profile: { name: user.name, hostel_id: user.hostel_id },
      financials: {
        advance_paid: user.advance_paid,
        current_balance: user.current_balance,
        fee_due_status: user.fee_due_status,
        amount_due: user.amount_due,
      },
      meals_consumed: mealsConsumed,
      today_menu,
    });
  } catch (err) { next(err); }
});

// POST /student/poll
router.post("/poll", [
  body("menu_id").notEmpty().withMessage("menu_id is required."),
  body("intention").isIn(["YES", "NO"]).withMessage("Intention must be YES or NO."),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { menu_id, intention } = req.body;
    const studentId = req.user.id;

    const menu = await prisma.menu.findUnique({ where: { id: menu_id } });
    if (!menu) return res.status(404).json({ error: "Meal not found." });

    const locked = await isPollLocked(menu);
    if (locked) return res.status(406).json({ error: "Poll is locked for this meal." });

    const poll = await prisma.poll.upsert({
      where: { student_id_menu_id: { student_id: studentId, menu_id } },
      update: { intention },
      create: { student_id: studentId, menu_id, intention },
    });

    let snack_token_generated = false;
    let token_data = null;

    if (intention === "NO") {
      const existing = await prisma.snackToken.findUnique({ where: { poll_id: poll.id } });
      if (!existing) {
        const token_code = `SNK-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        await prisma.snackToken.create({
          data: { student_id: studentId, poll_id: poll.id, token_code, status: "ISSUED" },
        });
        snack_token_generated = true;
        token_data = { token_code, valid_for: menu.meal_type };
      } else {
        if (existing.status === "EXPIRED") {
          await prisma.snackToken.update({
            where: { id: existing.id },
            data: { status: "ISSUED" }
          });
        }
        snack_token_generated = true;
        token_data = { token_code: existing.token_code, valid_for: menu.meal_type };
      }
    } else if (intention === "YES") {
      await prisma.snackToken.updateMany({
        where: { poll_id: poll.id, status: "ISSUED" },
        data: { status: "EXPIRED" },
      });
    }

    res.json({ message: "Poll recorded.", snack_token_generated, token_data });
  } catch (err) { next(err); }
});

// POST /student/payment/initiate (stub — no Razorpay in dev)
router.post("/payment/initiate", async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { fee_due_status: true, amount_due: true },
    });

    if (!user.fee_due_status) {
      return res.status(400).json({ error: "No payment due at this time." });
    }

    const orderId = `order_dev_${Date.now()}`;
    await prisma.transaction.create({
      data: { student_id: studentId, amount: user.amount_due, gateway_ref_id: orderId, status: "PENDING" },
    });

    res.json({ order_id: orderId, amount_due: user.amount_due, currency: "INR", gateway_key: "rzp_test_dev" });
  } catch (err) { next(err); }
});

// GET /student/history
router.get("/history", async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const [meals, tokens, payments, totalMeals, totalTokens, totalPayments] = await Promise.all([
      prisma.mealAttendance.findMany({
        where: { student_id: studentId }, orderBy: { scanned_at: "desc" }, take: limit, skip: offset,
        include: { menu: { select: { meal_type: true, items: true, meal_date: true } } },
      }),
      prisma.snackToken.findMany({
        where: { student_id: studentId }, take: limit, skip: offset,
        include: { poll: { select: { menu: { select: { meal_type: true, meal_date: true } } } } },
      }),
      prisma.transaction.findMany({
        where: { student_id: studentId }, orderBy: { paid_at: "desc" }, take: limit, skip: offset,
      }),
      prisma.mealAttendance.count({ where: { student_id: studentId } }),
      prisma.snackToken.count({ where: { student_id: studentId } }),
      prisma.transaction.count({ where: { student_id: studentId } }),
    ]);

    res.json({
      meals: { data: meals.map((m) => ({ date: m.menu.meal_date, meal_type: m.menu.meal_type, items: parseItems(m.menu.items), deduction: m.deduction_amount, scanned_at: m.scanned_at })), total: totalMeals },
      tokens: { data: tokens.map((t) => ({ date: t.poll?.menu?.meal_date, meal_type: t.poll?.menu?.meal_type, token_code: t.token_code, status: t.status, redeemed_at: t.redeemed_at })), total: totalTokens },
      payments: { data: payments.map((p) => ({ amount: p.amount, status: p.status, gateway_ref: p.gateway_ref_id, paid_at: p.paid_at })), total: totalPayments },
      pagination: { page, limit },
    });
  } catch (err) { next(err); }
});

module.exports = router;
