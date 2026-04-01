// src/routes/manager.routes.js
// Implements API.md Section 4 + PRD/features implied endpoints
// Complete: dashboard, AI predict, tokens, defaulters, menu CRUD, attendance, reminders

const express = require("express");
const router = express.Router();
const { body, query, validationResult } = require("express-validator");

const prisma = require("../config/prisma");
const { authenticate, requireManager } = require("../middleware/auth.middleware");
const { sendReminderEmail } = require("../utils/email.util");

router.use(authenticate, requireManager);

// ─── 4.1 GET /manager/dashboard/upcoming-meal ────────────────────────────────
router.get("/dashboard/upcoming-meal", async (req, res, next) => {
  try {
    const now = new Date();

    const nextMenu = await prisma.menu.findFirst({
      where: { serve_time: { gt: now } },
      orderBy: { serve_time: "asc" },
    });

    if (!nextMenu) {
      return res.status(404).json({ error: "No upcoming meals scheduled." });
    }

    const [yesCount, noCount, totalStudents] = await Promise.all([
      prisma.poll.count({ where: { menu_id: nextMenu.id, intention: "YES" } }),
      prisma.poll.count({ where: { menu_id: nextMenu.id, intention: "NO" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
    ]);

    const isPollLocked = now >= nextMenu.poll_cutoff_time;

    res.json({
      menu_id: nextMenu.id,
      meal_type: nextMenu.meal_type,
      items: nextMenu.items,
      serve_time: nextMenu.serve_time,
      poll_status: isPollLocked ? "LOCKED" : "OPEN",
      total_students: totalStudents,
      votes_yes: yesCount,
      votes_no: noCount,
      votes_pending: totalStudents - yesCount - noCount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 4.2 GET /manager/ai/predict?menu_id=xxx ─────────────────────────────────
router.get("/ai/predict", async (req, res, next) => {
  try {
    const { menu_id } = req.query;
    if (!menu_id) {
      return res.status(400).json({ error: "menu_id query parameter is required." });
    }

    const menu = await prisma.menu.findUnique({ where: { id: menu_id } });
    if (!menu) {
      return res.status(404).json({ error: "Menu not found." });
    }

    const yesVotes = await prisma.poll.count({
      where: { menu_id, intention: "YES" },
    });

    const dayOfWeek = new Date(menu.serve_time).toLocaleDateString("en-US", {
      weekday: "long",
    });

    const factor1 = await prisma.$queryRaw`
      SELECT
        AVG(deviation_percentage) AS avg_deviation,
        COUNT(*)::int             AS sample_size
      FROM ai_training_data
      WHERE meal_type = ${menu.meal_type}::"MealType"
        AND day_of_week = ${dayOfWeek}
    `;

    const menuItems = Array.isArray(menu.items) ? menu.items : [];
    let factor2 = [{ avg_deviation: null, sample_size: 0 }];

    if (menuItems.length > 0) {
      factor2 = await prisma.$queryRaw`
        SELECT
          AVG(deviation_percentage) AS avg_deviation,
          COUNT(*)::int             AS sample_size
        FROM ai_training_data
        WHERE meal_type = ${menu.meal_type}::"MealType"
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(menu_items) AS item
            WHERE item = ANY(${menuItems}::text[])
          )
      `;
    }

    const factor3 = await prisma.$queryRaw`
      SELECT
        AVG(deviation_percentage) AS avg_deviation,
        COUNT(*)::int             AS sample_size
      FROM ai_training_data
      WHERE meal_type = ${menu.meal_type}::"MealType"
    `;

    const WEIGHT_DAY = 0.60;
    const WEIGHT_ITEMS = 0.25;
    const WEIGHT_BASE = 0.15;
    const DEFAULT_DEVIATION = 8.5;

    const dev1 = Number(factor1[0]?.avg_deviation ?? DEFAULT_DEVIATION);
    const dev2 = Number(factor2[0]?.avg_deviation ?? dev1);
    const dev3 = Number(factor3[0]?.avg_deviation ?? DEFAULT_DEVIATION);

    const weightedDeviation =
      dev1 * WEIGHT_DAY + dev2 * WEIGHT_ITEMS + dev3 * WEIGHT_BASE;

    const predictedAttendance = Math.round(
      yesVotes * (1 - weightedDeviation / 100)
    );
    const recommendation = predictedAttendance + 3;

    const totalSamples =
      Number(factor1[0]?.sample_size ?? 0) +
      Number(factor2[0]?.sample_size ?? 0) +
      Number(factor3[0]?.sample_size ?? 0);

    let confidence;
    if (totalSamples >= 50) confidence = "HIGH";
    else if (totalSamples >= 10) confidence = "MEDIUM";
    else confidence = "LOW";

    res.json({
      raw_yes_votes: yesVotes,
      historical_deviation_rate: `-${weightedDeviation.toFixed(1)}%`,
      ai_predicted_attendance: predictedAttendance,
      recommendation: `Cook for ${recommendation} students.`,
      confidence,
      factors: {
        meal_type_day: {
          deviation: `${dev1.toFixed(1)}%`,
          weight: `${(WEIGHT_DAY * 100).toFixed(0)}%`,
          samples: Number(factor1[0]?.sample_size ?? 0),
        },
        menu_items: {
          deviation: `${dev2.toFixed(1)}%`,
          weight: `${(WEIGHT_ITEMS * 100).toFixed(0)}%`,
          samples: Number(factor2[0]?.sample_size ?? 0),
        },
        overall_baseline: {
          deviation: `${dev3.toFixed(1)}%`,
          weight: `${(WEIGHT_BASE * 100).toFixed(0)}%`,
          samples: Number(factor3[0]?.sample_size ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── 4.3 GET /manager/tokens/active ──────────────────────────────────────────
// Supports ?search=name for filtering (features.md 4.3)
router.get("/tokens/active", async (req, res, next) => {
  try {
    const now = new Date();
    const { search } = req.query;

    const nextMenu = await prisma.menu.findFirst({
      where: { serve_time: { gt: now } },
      orderBy: { serve_time: "asc" },
    });

    if (!nextMenu) {
      return res.status(404).json({ error: "No active meal window." });
    }

    const whereClause = {
      status: "ISSUED",
      poll: { menu_id: nextMenu.id },
    };

    if (search && search.trim()) {
      whereClause.student = {
        name: { contains: search.trim(), mode: "insensitive" },
      };
    }

    const tokens = await prisma.snackToken.findMany({
      where: whereClause,
      include: {
        student: { select: { name: true, email: true, hostel_id: true } },
      },
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
  } catch (err) {
    next(err);
  }
});

// ─── 4.4 PUT /manager/tokens/redeem ──────────────────────────────────────────
router.put("/tokens/redeem", async (req, res, next) => {
  try {
    const { token_code } = req.body;
    if (!token_code) {
      return res.status(400).json({ error: "token_code is required." });
    }

    const token = await prisma.snackToken.findUnique({ where: { token_code } });

    if (!token) return res.status(404).json({ error: "Token not found." });
    if (token.status === "REDEEMED") return res.status(409).json({ error: "Token already redeemed." });
    if (token.status === "EXPIRED") return res.status(410).json({ error: "Token has expired." });

    await prisma.snackToken.update({
      where: { token_code },
      data: { status: "REDEEMED", redeemed_at: new Date() },
    });

    res.json({ message: "Token redeemed successfully." });
  } catch (err) {
    next(err);
  }
});

// ─── 4.5 GET /manager/defaulters ─────────────────────────────────────────────
router.get("/defaulters", async (req, res, next) => {
  try {
    const defaulters = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        OR: [{ fee_due_status: true }, { current_balance: { lt: 0 } }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        current_balance: true,
        fee_due_status: true,
        amount_due: true,
        hostel_id: true,
      },
      orderBy: { current_balance: "asc" },
    });

    res.json(
      defaulters.map((d) => ({
        student_id: d.id,
        name: d.name,
        email: d.email,
        hostel_id: d.hostel_id,
        current_balance: Number(d.current_balance),
        amount_due: Number(d.amount_due),
        fee_due_status: d.fee_due_status,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ─── 4.6 POST /manager/defaulters/remind ─────────────────────────────────────
// PRD 3.2 step 4: "Sends payment reminders to students with pending fees."
router.post("/defaulters/remind", async (req, res, next) => {
  try {
    const { student_ids } = req.body;

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: "student_ids array is required." });
    }

    const students = await prisma.user.findMany({
      where: {
        id: { in: student_ids },
        role: "STUDENT",
        OR: [{ fee_due_status: true }, { current_balance: { lt: 0 } }],
      },
      select: { name: true, email: true, amount_due: true },
    });

    let sent = 0;
    const failures = [];

    for (const student of students) {
      try {
        await sendReminderEmail(student.email, student.name, student.amount_due);
        sent++;
      } catch (err) {
        failures.push({ email: student.email, error: err.message });
      }
    }

    res.json({
      message: `Reminders sent to ${sent} of ${students.length} students.`,
      sent,
      failed: failures.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MENU CRUD — Manager creates/updates daily menus
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /manager/menus?date=YYYY-MM-DD ──────────────────────────────────────
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

    res.json(menus);
  } catch (err) {
    next(err);
  }
});

// ─── POST /manager/menus ─────────────────────────────────────────────────────
router.post(
  "/menus",
  [
    body("meal_date").isISO8601().withMessage("meal_date must be a valid date."),
    body("meal_type").isIn(["BREAKFAST", "LUNCH", "SNACKS", "DINNER"]).withMessage("Invalid meal_type."),
    body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array."),
    body("serve_time").isISO8601().withMessage("serve_time must be a valid ISO timestamp."),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { meal_date, meal_type, items, serve_time } = req.body;
      const serveDate = new Date(serve_time);
      const pollCutoff = new Date(serveDate.getTime() - 4 * 60 * 60 * 1000);

      const menu = await prisma.menu.create({
        data: {
          meal_date: new Date(meal_date),
          meal_type,
          items,
          serve_time: serveDate,
          poll_cutoff_time: pollCutoff,
        },
      });

      res.status(201).json(menu);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /manager/menus/:id ──────────────────────────────────────────────────
router.put("/menus/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, serve_time } = req.body;

    const existing = await prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Menu not found." });
    }

    const updateData = {};
    if (items) updateData.items = items;
    if (serve_time) {
      updateData.serve_time = new Date(serve_time);
      updateData.poll_cutoff_time = new Date(
        new Date(serve_time).getTime() - 4 * 60 * 60 * 1000
      );
    }

    const updated = await prisma.menu.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /manager/menus/:id ───────────────────────────────────────────────
router.delete("/menus/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Menu not found." });
    }

    const pollCount = await prisma.poll.count({ where: { menu_id: id } });
    if (pollCount > 0) {
      return res.status(409).json({
        error: "Cannot delete a menu that already has poll votes.",
      });
    }

    await prisma.menu.delete({ where: { id } });
    res.json({ message: "Menu deleted." });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL ATTENDANCE — Records that a student showed up and ate.
// The DB trigger trg_deduct_meal_balance auto-deducts from their balance.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /manager/attendance/record ─────────────────────────────────────────
router.post(
  "/attendance/record",
  [
    body("student_id").notEmpty().withMessage("student_id is required."),
    body("menu_id").notEmpty().withMessage("menu_id is required."),
    body("deduction_amount")
      .isFloat({ gt: 0 })
      .withMessage("deduction_amount must be a positive number."),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { student_id, menu_id, deduction_amount } = req.body;

      const student = await prisma.user.findUnique({ where: { id: student_id } });
      if (!student || student.role !== "STUDENT") {
        return res.status(404).json({ error: "Student not found." });
      }

      const menu = await prisma.menu.findUnique({ where: { id: menu_id } });
      if (!menu) {
        return res.status(404).json({ error: "Menu not found." });
      }

      const alreadyRecorded = await prisma.mealAttendance.findFirst({
        where: { student_id, menu_id },
      });
      if (alreadyRecorded) {
        return res.status(409).json({ error: "Attendance already recorded for this meal." });
      }

      const record = await prisma.mealAttendance.create({
        data: {
          student_id,
          menu_id,
          deduction_amount,
        },
      });

      res.status(201).json({
        message: "Attendance recorded. Balance deducted automatically.",
        record,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
