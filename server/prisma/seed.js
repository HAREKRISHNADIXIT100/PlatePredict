// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Manager account
  const managerEmail = "manager@college.edu";
  let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        name: "Mess Manager",
        email: managerEmail,
        password_hash: await bcrypt.hash("Manager@1234", 12),
        role: "MANAGER",
        hostel_id: "ADMIN",
      },
    });
    console.log("✅ Manager: manager@college.edu / Manager@1234");
  }

  // Test student
  const studentEmail = "rahul.k@college.edu";
  let student = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        name: "Rahul Kumar",
        email: studentEmail,
        password_hash: await bcrypt.hash("Student@1234", 12),
        role: "STUDENT",
        hostel_id: "H-Block-B",
        advance_paid: 15000,
        current_balance: 12450.50,
      },
    });
    console.log("✅ Student: rahul.k@college.edu / Student@1234");
  }

  // Second student (to make the dashboard more interesting)
  const student2Email = "priya.s@college.edu";
  let student2 = await prisma.user.findUnique({ where: { email: student2Email } });
  if (!student2) {
    student2 = await prisma.user.create({
      data: {
        name: "Priya Sharma",
        email: student2Email,
        password_hash: await bcrypt.hash("Student@1234", 12),
        role: "STUDENT",
        hostel_id: "G-Block-A",
        advance_paid: 15000,
        current_balance: -150,
        fee_due_status: true,
        amount_due: 15000,
      },
    });
    console.log("✅ Student: priya.s@college.edu / Student@1234 (defaulter)");
  }

  // Today's menus
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const existingMenus = await prisma.menu.count({
    where: { meal_date: { gte: today, lt: tomorrow } },
  });

  if (existingMenus === 0) {
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();

    // Set serve times in the FUTURE so polls/dashboard work
    const now = new Date();
    const hour = now.getHours();

    const menus = [
      { type: "BREAKFAST", items: ["Poha", "Boiled Eggs", "Bread & Butter", "Chai"], hour: Math.max(hour + 1, 8) },
      { type: "LUNCH", items: ["Rice", "Dal Tadka", "Mix Veg", "Roti", "Salad"], hour: Math.max(hour + 2, 13) },
      { type: "SNACKS", items: ["Samosa", "Chai", "Biscuits"], hour: Math.max(hour + 3, 17) },
      { type: "DINNER", items: ["Paneer Butter Masala", "Rice", "Roti", "Raita", "Gulab Jamun"], hour: Math.max(hour + 4, 20) },
    ];

    for (const menu of menus) {
      const serve_time = new Date(y, m, d, menu.hour, 0, 0);
      const poll_cutoff_time = new Date(serve_time.getTime() - 4 * 60 * 60 * 1000);

      await prisma.menu.create({
        data: {
          meal_date: today,
          meal_type: menu.type,
          items: JSON.stringify(menu.items),
          serve_time,
          poll_cutoff_time,
        },
      });
    }
    console.log("✅ Today's menus seeded (Breakfast, Lunch, Snacks, Dinner)");
  }

  console.log("\n🌱 Done!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
