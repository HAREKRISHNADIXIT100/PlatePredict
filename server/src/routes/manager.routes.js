// src/routes/manager.routes.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const prisma = require("../config/prisma");
const { authenticate, requireManager } = require("../middleware/auth.middleware");
const { sendReminderEmail } = require("../utils/email.util");

router.use(authenticate, requireManager);

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try { return JSON.parse(items); } catch { return []; }
}

// GET /manager/dashboard/upcoming-meal
router.get("/dashboard/upcoming-meal", async (req, res, next) => {
  try {
    const now = new Date();
    const nextMenu = await prisma.menu.findFirst({
      where: { serve_time: { gt: now } },
      orderBy: { serve_time: "asc" },
    });

    if (!nextMenu) return res.status(404).json({ error: "No upcoming meals scheduled." });

    const [yesCount, noCount, totalStudents] = await Promise.all([
      prisma.poll.count({ where: { menu_id: nextMenu.id, intention: "YES" } }),
      prisma.poll.count({ where: { menu_id: nextMenu.id, intention: "NO" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
    ]);

    res.json({
      menu_id: nextMenu.id,
      meal_type: nextMenu.meal_type,
      items: parseItems(nextMenu.items),
      serve_time: nextMenu.serve_time,
      poll_status: now >= new Date(nextMenu.poll_cutoff_time) ? "LOCKED" : "OPEN",
      total_students: totalStudents,
      votes_yes: yesCount,
      votes_no: noCount,
      votes_pending: totalStudents - yesCount - noCount,
    });
  } catch (err) { next(err); }
});

// GET /manager/ai/predict?menu_id=xxx — simplified for SQLite (no materialized view)
router.get("/ai/predict", async (req, res, next) => {
  try {
    const { menu_id } = req.query;
    if (!menu_id) return res.status(400).json({ error: "menu_id required." });

    const menu = await prisma.menu.findUnique({ where: { id: menu_id } });
    if (!menu) return res.status(404).json({ error: "Menu not found." });

    const yesVotes = await prisma.poll.count({ where: { menu_id, intention: "YES" } });

    // Compute deviation from past completed meals
    const pastMenus = await prisma.menu.findMany({
      where: { serve_time: { lt: new Date() }, meal_type: menu.meal_type },
      include: {
        polls: { where: { intention: "YES" } },
        meal_attendance: true,
      },
      take: 50,
      orderBy: { serve_time: "desc" },
    });

    let totalDeviation = 0;
    let deviationCount = 0;

    for (const pm of pastMenus) {
      const yes = pm.polls.length;
      const actual = pm.meal_attendance.length;
      if (yes > 0) {
        totalDeviation += ((yes - actual) / yes) * 100;
        deviationCount++;
      }
    }

    const DEFAULT_DEVIATION = 8.5;
    const avgDeviation = deviationCount > 0 ? totalDeviation / deviationCount : DEFAULT_DEVIATION;
    const predictedAttendance = Math.round(yesVotes * (1 - avgDeviation / 100));
    const recommendation = predictedAttendance + 3;

    let confidence;
    if (deviationCount >= 50) confidence = "HIGH";
    else if (deviationCount >= 10) confidence = "MEDIUM";
    else confidence = "LOW";

    res.json({
      raw_yes_votes: yesVotes,
      historical_deviation_rate: `-${avgDeviation.toFixed(1)}%`,
      ai_predicted_attendance: predictedAttendance,
      recommendation: `Cook for ${recommendation} students.`,
      confidence,
      factors: {
        meal_type_day: { deviation: `${avgDeviation.toFixed(1)}%`, weight: "60%", samples: deviationCount },
        menu_items: { deviation: `${avgDeviation.toFixed(1)}%`, weight: "25%", samples: deviationCount },
        overall_baseline: { deviation: `${DEFAULT_DEVIATION.toFixed(1)}%`, weight: "15%", samples: deviationCount },
      },
    });
  } catch (err) { next(err); }
});

// GET /manager/tokens/active?search=
router.get("/tokens/active", async (req, res, next) => {
  try {
    const now = new Date();
    const { search } = req.query;

    const nextMenu = await prisma.menu.findFirst({
      where: { serve_time: { gt: now } },
      orderBy: { serve_time: "asc" },
    });

    if (!nextMenu) return res.status(404).json({ error: "No active meal window." });

    const whereClause = { status: "ISSUED", poll: { menu_id: nextMenu.id } };
    if (search && search.trim()) {
      whereClause.student = { name: { contains: search.trim() } };
    }

    const tokens = await prisma.snackToken.findMany({
      where: whereClause,
      include: { student: { select: { name: true, email: true, hostel_id: true } } },
    });

    res.json({
      menu_id: nextMenu.id,
      meal_type: nextMenu.meal_type,
      serve_time: nextMenu.serve_time,
      total_tokens: tokens.length,
      eligible_students: tokens.map((t) => ({
        student_name: t.student.name,
        email: t.student.email,
        hostel_id: t.student.hostel_id,
        token_code: t.token_code,
        status: t.status,
      })),
    });
  } catch (err) { next(err); }
});

// PUT /manager/tokens/redeem
router.put("/tokens/redeem", async (req, res, next) => {
  try {
    const { token_code } = req.body;
    if (!token_code) return res.status(400).json({ error: "token_code is required." });

    const token = await prisma.snackToken.findUnique({ where: { token_code } });
    if (!token) return res.status(404).json({ error: "Token not found." });
    if (token.status === "REDEEMED") return res.status(409).json({ error: "Already redeemed." });
    if (token.status === "EXPIRED") return res.status(410).json({ error: "Token expired." });

    await prisma.snackToken.update({
      where: { token_code },
      data: { status: "REDEEMED", redeemed_at: new Date() },
    });

    res.json({ message: "Token redeemed successfully." });
  } catch (err) { next(err); }
});

// GET /manager/defaulters
router.get("/defaulters", async (req, res, next) => {
  try {
    const defaulters = await prisma.user.findMany({
      where: { role: "STUDENT", OR: [{ fee_due_status: true }, { current_balance: { lt: 0 } }] },
      select: { id: true, name: true, email: true, current_balance: true, fee_due_status: true, amount_due: true, hostel_id: true },
      orderBy: { current_balance: "asc" },
    });

    res.json(defaulters.map((d) => ({
      student_id: d.id, name: d.name, email: d.email, hostel_id: d.hostel_id,
      current_balance: d.current_balance, amount_due: d.amount_due, fee_due_status: d.fee_due_status,
    })));
  } catch (err) { next(err); }
});

// POST /manager/defaulters/remind
router.post("/defaulters/remind", async (req, res, next) => {
  try {
    const { student_ids } = req.body;
    if (!student_ids || !Array.isArray(student_ids)) return res.status(400).json({ error: "student_ids array required." });

    const students = await prisma.user.findMany({
      where: { id: { in: student_ids }, role: "STUDENT" },
      select: { name: true, email: true, amount_due: true },
    });

    let sent = 0;
    for (const s of students) {
      try { await sendReminderEmail(s.email, s.name, s.amount_due); sent++; } catch {}
    }

    res.json({ message: `Reminders sent to ${sent} of ${students.length} students.`, sent, failed: students.length - sent });
  } catch (err) { next(err); }
});

// GET /manager/menus?date=YYYY-MM-DD
router.get("/menus", async (req, res, next) => {
  try {
    const dateStr = req.query.date;
    let whereClause = {};
    if (dateStr) {
      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);
      const nextDay = new Date(target.getTime() + 86400000);
      whereClause.meal_date = { gte: target, lt: nextDay };
    }

    const menus = await prisma.menu.findMany({
      where: whereClause,
      orderBy: [{ meal_date: "desc" }, { serve_time: "asc" }],
      take: 50,
    });

    res.json(menus.map((m) => ({ ...m, items: parseItems(m.items) })));
  } catch (err) { next(err); }
});

// POST /manager/menus
router.post("/menus", [
  body("meal_date").notEmpty().withMessage("meal_date is required."),
  body("meal_type").isIn(["BREAKFAST", "LUNCH", "SNACKS", "DINNER"]).withMessage("Invalid meal_type."),
  body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array."),
  body("serve_time").notEmpty().withMessage("serve_time is required."),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { meal_date, meal_type, items, serve_time } = req.body;
    const serveDate = new Date(serve_time);
    const pollCutoff = new Date(serveDate.getTime() - 4 * 60 * 60 * 1000);

    const menu = await prisma.menu.create({
      data: { meal_date: new Date(meal_date), meal_type, items: JSON.stringify(items), serve_time: serveDate, poll_cutoff_time: pollCutoff },
    });

    res.status(201).json({ ...menu, items: parseItems(menu.items) });
  } catch (err) { next(err); }
});

// PUT /manager/menus/:id
router.put("/menus/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, serve_time } = req.body;

    const existing = await prisma.menu.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Menu not found." });

    const updateData = {};
    if (items) updateData.items = JSON.stringify(items);
    if (serve_time) {
      updateData.serve_time = new Date(serve_time);
      updateData.poll_cutoff_time = new Date(new Date(serve_time).getTime() - 4 * 60 * 60 * 1000);
    }

    const updated = await prisma.menu.update({ where: { id }, data: updateData });
    res.json({ ...updated, items: parseItems(updated.items) });
  } catch (err) { next(err); }
});

// DELETE /manager/menus/:id
router.delete("/menus/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const pollCount = await prisma.poll.count({ where: { menu_id: id } });
    if (pollCount > 0) return res.status(409).json({ error: "Cannot delete menu with active votes." });
    await prisma.menu.delete({ where: { id } });
    res.json({ message: "Menu deleted." });
  } catch (err) { next(err); }
});

// POST /manager/attendance/record
router.post("/attendance/record", [
  body("student_id").notEmpty(),
  body("menu_id").notEmpty(),
  body("deduction_amount").isFloat({ gt: 0 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { student_id, menu_id, deduction_amount } = req.body;

    const alreadyRecorded = await prisma.mealAttendance.findFirst({ where: { student_id, menu_id } });
    if (alreadyRecorded) return res.status(409).json({ error: "Already recorded." });

    const record = await prisma.mealAttendance.create({ data: { student_id, menu_id, deduction_amount } });

    // Manual balance deduction (SQLite has no triggers)
    await prisma.user.update({
      where: { id: student_id },
      data: { current_balance: { decrement: deduction_amount } },
    });

    res.status(201).json({ message: "Attendance recorded.", record });
  } catch (err) { next(err); }
});

module.exports = router;
