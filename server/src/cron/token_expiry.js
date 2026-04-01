// src/cron/token_expiry.js
// Background jobs (no-op in SQLite dev mode — runs but uses Prisma)
const cron = require("node-cron");
const prisma = require("../config/prisma");

function startAllCronJobs() {
  // Token expiry every 30 minutes
  cron.schedule("0,30 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await prisma.snackToken.updateMany({
        where: {
          status: "ISSUED",
          poll: { menu: { serve_time: { lt: cutoff } } },
        },
        data: { status: "EXPIRED" },
      });
      if (result.count > 0) console.log(`[CRON] Expired ${result.count} token(s).`);
    } catch (err) {
      console.error("[CRON:TOKEN_EXPIRY]", err.message);
    }
  });
  console.log("⏰ Token expiry cron started (every 30 min).");
}

module.exports = { startAllCronJobs };
