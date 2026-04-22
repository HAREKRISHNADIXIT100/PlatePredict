// prisma/seed_production.js
// Safe production seeder — creates ONLY the manager account.
// Does NOT delete any existing data. Does NOT create fake students.
// Safe to run multiple times (skips if manager already exists).

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const managerEmail = process.env.MANAGER_EMAIL || "manager@nitj.ac.in";
  const managerPassword = process.env.MANAGER_PASSWORD || "Manager@1234";

  console.log("🔒 Production Seed — Creating manager account (if not exists)...\n");

  // Check if manager already exists
  const existing = await prisma.user.findFirst({
    where: { role: "MANAGER" },
  });

  if (existing) {
    console.log(`✅ Manager already exists: ${existing.email}`);
    console.log("   No changes made. Database is intact.");
    return;
  }

  // Create manager
  const password_hash = await bcrypt.hash(managerPassword, 12);

  const manager = await prisma.user.create({
    data: {
      name: "Mess Manager",
      email: managerEmail,
      password_hash,
      role: "MANAGER",
      hostel_id: "ADMIN",
      advance_paid: 0,
      current_balance: 0,
      fee_due_status: false,
      amount_due: 0,
      reward_points: 0,
    },
  });

  console.log(`✅ Manager created successfully!`);
  console.log(`   Email: ${manager.email}`);
  console.log(`   Password: ${managerPassword}`);
  console.log(`\n⚠️  Change the default password after first login!`);
}

main()
  .catch((e) => {
    console.error("❌ Production seed failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
