// prisma/seed.js
// Seeds the database with a default manager account and today's meal menus.
// Run with: npm run prisma:seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── 1. Create default manager account ────────────────────────────────────
  const managerEmail = "manager@college.edu";
  const existingManager = await prisma.user.findUnique({
    where: { email: managerEmail },
  });

  if (!existingManager) {
    const hash = await bcrypt.hash("Manager@1234", 12);
    await prisma.user.create({
      data: {
        name: "Mess Manager",
        email: managerEmail,
        password_hash: hash,
        role: "MANAGER",
        hostel_id: "ADMIN",
      },
    });
    console.log("✅ Manager account created (manager@college.edu / Manager@1234)");
  } else {
    console.log("ℹ️  Manager account already exists, skipping.");
  }

  // ── 2. Seed today's meal menus ───────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingMenus = await prisma.menu.count({
    where: {
      meal_date: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
  });

  if (existingMenus === 0) {
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    const menus = [
      {
        meal_date: today,
        meal_type: "BREAKFAST",
        items: ["Poha", "Boiled Eggs", "Bread & Butter", "Chai"],
        serve_time: new Date(year, month, day, 8, 0),
        poll_cutoff_time: new Date(year, month, day, 4, 0),
      },
      {
        meal_date: today,
        meal_type: "LUNCH",
        items: ["Rice", "Dal Tadka", "Mix Veg", "Roti", "Salad"],
        serve_time: new Date(year, month, day, 13, 0),
        poll_cutoff_time: new Date(year, month, day, 9, 0),
      },
      {
        meal_date: today,
        meal_type: "SNACKS",
        items: ["Samosa", "Chai", "Biscuits"],
        serve_time: new Date(year, month, day, 17, 0),
        poll_cutoff_time: new Date(year, month, day, 13, 0),
      },
      {
        meal_date: today,
        meal_type: "DINNER",
        items: ["Paneer Butter Masala", "Rice", "Roti", "Raita", "Gulab Jamun"],
        serve_time: new Date(year, month, day, 20, 0),
        poll_cutoff_time: new Date(year, month, day, 16, 0),
      },
    ];

    for (const menu of menus) {
      await prisma.menu.create({ data: menu });
    }
    console.log("✅ Today's menus seeded (Breakfast, Lunch, Snacks, Dinner)");
  } else {
    console.log("ℹ️  Today's menus already exist, skipping.");
  }

  // ── 3. Seed a sample student for testing ─────────────────────────────────
  const studentEmail = "rahul.k@college.edu";
  const existingStudent = await prisma.user.findUnique({
    where: { email: studentEmail },
  });

  if (!existingStudent) {
    const hash = await bcrypt.hash("Student@1234", 12);
    await prisma.user.create({
      data: {
        name: "Rahul Kumar",
        email: studentEmail,
        password_hash: hash,
        role: "STUDENT",
        hostel_id: "H-Block-B",
        advance_paid: 15000.0,
        current_balance: 12450.5,
        fee_due_status: false,
      },
    });
    console.log("✅ Test student created (rahul.k@college.edu / Student@1234)");
  } else {
    console.log("ℹ️  Test student already exists, skipping.");
  }

  console.log("\n🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
