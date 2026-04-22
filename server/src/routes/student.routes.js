// src/routes/student.routes.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const prisma = require("../config/prisma");
const { authenticate, requireStudent } = require("../middleware/auth.middleware");

router.use(authenticate, requireStudent);

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try { return JSON.parse(items); } catch { return []; }
}

async function isPollLocked(menu) {
  const now = new Date();

  // Simple check: if current time is past the poll cutoff, the poll is locked.
  // For breakfast, poll_cutoff_time is set to 10 PM previous night at menu creation.
  // For other meals, poll_cutoff_time is set to serve_time - 4 hours at menu creation.
  if (now >= new Date(menu.poll_cutoff_time)) {
    return true;
  }

  return false;
}

// GET /student/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, hostel_id: true, advance_paid: true, current_balance: true, fee_due_status: true, amount_due: true, reward_points: true },
    });

    const activeLeave = await prisma.leave.findFirst({
      where: {
        student_id: studentId,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const nextDay = new Date(tomorrow.getTime() + 86400000);

    const menus = await prisma.menu.findMany({
      where: { meal_date: { gte: today, lt: nextDay } },
      orderBy: { serve_time: "asc" },
      include: {
        polls: {
          where: { student_id: studentId },
          select: { intention: true },
        },
      },
    });

    const upcoming_menus = await Promise.all(
      menus.map(async (menu) => {
        const locked = await isPollLocked(menu);
        const studentPoll = menu.polls[0] || null;
        return {
          menu_id: menu.id,
          meal_type: menu.meal_type,
          meal_date: menu.meal_date,
          items: parseItems(menu.items),
          serve_time: menu.serve_time,
          poll_cutoff_time: menu.poll_cutoff_time,
          poll_locked: locked,
          student_voted: !!studentPoll,
          student_intention: studentPoll?.intention || null,
        };
      })
    );

    const mealsConsumed = await prisma.mealAttendance.count({ where: { student_id: studentId } });

    // Count NO-poll + attended violations this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const noPolls = await prisma.poll.findMany({
      where: {
        student_id: studentId,
        intention: "NO",
        menu: { meal_date: { gte: monthStart, lt: monthEnd } },
      },
      select: { menu_id: true },
    });

    let noShowViolations = 0;
    for (const poll of noPolls) {
      const attended = await prisma.mealAttendance.findFirst({
        where: { student_id: studentId, menu_id: poll.menu_id },
      });
      if (attended) noShowViolations++;
    }

    res.json({
      profile: { name: user.name, hostel_id: user.hostel_id },
      financials: {
        advance_paid: user.advance_paid,
        current_balance: user.current_balance,
        fee_due_status: user.fee_due_status,
        amount_due: user.amount_due,
      },
      reward_points: user.reward_points,
      meals_consumed: mealsConsumed,
      no_show_violations: noShowViolations,
      on_leave: !!activeLeave,
      upcoming_menus,
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

    const overlappingLeave = await prisma.leave.findFirst({
      where: {
        student_id: studentId,
        start_date: { lte: menu.meal_date },
        end_date: { gte: menu.meal_date },
      },
    });
    if (overlappingLeave) return res.status(403).json({ error: "Your account is on leave for this meal date." });

    await prisma.poll.upsert({
      where: { student_id_menu_id: { student_id: studentId, menu_id } },
      update: { intention },
      create: { student_id: studentId, menu_id, intention },
    });

    res.json({ message: "Poll recorded." });
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

    const [meals, rewards, payments, totalMeals, totalRewards, totalPayments] = await Promise.all([
      prisma.mealAttendance.findMany({
        where: { student_id: studentId }, orderBy: { scanned_at: "desc" }, take: limit, skip: offset,
        include: { menu: { select: { meal_type: true, items: true, meal_date: true } } },
      }),
      prisma.rewardLog.findMany({
        where: { student_id: studentId }, orderBy: { created_at: "desc" }, take: limit, skip: offset,
        include: { menu: { select: { meal_type: true, meal_date: true } } },
      }),
      prisma.transaction.findMany({
        where: { student_id: studentId }, orderBy: { paid_at: "desc" }, take: limit, skip: offset,
      }),
      prisma.mealAttendance.count({ where: { student_id: studentId } }),
      prisma.rewardLog.count({ where: { student_id: studentId } }),
      prisma.transaction.count({ where: { student_id: studentId } }),
    ]);

    res.json({
      meals: { data: meals.map((m) => ({ date: m.menu.meal_date, meal_type: m.menu.meal_type, items: parseItems(m.menu.items), deduction: m.deduction_amount, scanned_at: m.scanned_at })), total: totalMeals },
      rewards: { data: rewards.map((r) => ({ date: r.menu.meal_date, meal_type: r.menu.meal_type, points: r.points, reason: r.reason, created_at: r.created_at })), total: totalRewards },
      payments: { data: payments.map((p) => ({ amount: p.amount, status: p.status, gateway_ref: p.gateway_ref_id, paid_at: p.paid_at })), total: totalPayments },
      pagination: { page, limit },
    });
  } catch (err) { next(err); }
});

module.exports = router;
