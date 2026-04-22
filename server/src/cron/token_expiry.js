// src/cron/token_expiry.js → reward_points.js
// Awards reward points to students who polled NO and genuinely skipped past meals.
const cron = require("node-cron");
const prisma = require("../config/prisma");

const MEAL_PRICES = {
  BREAKFAST: 40,
  LUNCH: 60,
  SNACKS: 20,
  DINNER: 60,
};

function startAllCronJobs() {
  // Reward points awarding — every 30 minutes
  cron.schedule("0,30 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours after serve_time

      // Find past meals that haven't been processed for rewards yet
      const unprocessedMenus = await prisma.menu.findMany({
        where: {
          serve_time: { lt: cutoff },
          rewards_processed: false,
        },
      });

      if (unprocessedMenus.length === 0) return;

      let totalAwarded = 0;
      let totalErrors = 0;

      for (const menu of unprocessedMenus) {
        try {
          // Find students who polled NO for this meal
          const noPolls = await prisma.poll.findMany({
            where: { menu_id: menu.id, intention: "NO" },
            select: { student_id: true },
          });

          for (const poll of noPolls) {
            try {
              // Check if the student actually attended (violation — don't award)
              const attended = await prisma.mealAttendance.findFirst({
                where: { student_id: poll.student_id, menu_id: menu.id },
              });

              if (!attended) {
                // Student genuinely skipped — award 60% of meal cost
                const mealCost = MEAL_PRICES[menu.meal_type] || 50;
                const rewardPts = Math.round(mealCost * 0.6);

                // Check if already awarded (safety)
                const existing = await prisma.rewardLog.findFirst({
                  where: { student_id: poll.student_id, menu_id: menu.id, reason: "MEAL_SKIP_REWARD" },
                });

                if (!existing) {
                  await prisma.rewardLog.create({
                    data: {
                      student_id: poll.student_id,
                      menu_id: menu.id,
                      points: rewardPts,
                      reason: "MEAL_SKIP_REWARD",
                    },
                  });

                  await prisma.user.update({
                    where: { id: poll.student_id },
                    data: { reward_points: { increment: rewardPts } },
                  });

                  totalAwarded++;
                }
              }
            } catch (studentErr) {
              console.error(`[CRON:REWARD] Error processing student ${poll.student_id} for menu ${menu.id}:`, studentErr.message);
              totalErrors++;
            }
          }

          // Mark menu as processed even if some students failed
          await prisma.menu.update({
            where: { id: menu.id },
            data: { rewards_processed: true },
          });
        } catch (menuErr) {
          console.error(`[CRON:REWARD] Error processing menu ${menu.id}:`, menuErr.message);
          totalErrors++;
        }
      }

      if (totalAwarded > 0 || totalErrors > 0) {
        console.log(`[CRON:REWARD] Processed ${unprocessedMenus.length} meal(s): ${totalAwarded} rewards awarded, ${totalErrors} errors.`);
      }
    } catch (err) {
      console.error("[CRON:REWARD_POINTS] Fatal error:", err.message);
    }
  });
  console.log("⏰ Reward points cron started (every 30 min).");
}

module.exports = { startAllCronJobs };

