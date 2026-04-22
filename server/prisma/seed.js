// prisma/seed.js
// ⚠️  DEV ONLY — Wipes ALL data and inserts fake students, menus, polls, etc.
// NEVER run this in production. Use seed_production.js for initial prod setup.

require("dotenv").config(); // Load .env so NODE_ENV is available

// ─── SAFETY GUARDS ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error("🚫 REFUSED: seed.js cannot run in NODE_ENV=production.");
  console.error("   This script DELETES ALL DATA and inserts fake records.");
  console.error("   For production setup, use: node prisma/seed_production.js");
  process.exit(1);
}

if (!process.argv.includes("--force")) {
  console.error("⚠️  WARNING: This will DELETE ALL existing data (users, menus, polls, etc.).");
  console.error("   If you're sure, re-run with: npm run seed -- --force");
  console.error("   For initial production setup, use: npm run seed:prod");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya", "Atharv", "Aarush", "Darsh", "Kabir", "Neha", "Priya", "Anjali", "Sneha", "Kriti", "Pooja", "Aarti", "Simran", "Riya", "Mansi", "Rohan", "Mohit", "Rahul", "Vikas", "Sandeep", "Amit", "Sumit", "Raj", "Karan", "Gaurav", "Nisha", "Swati", "Divya", "Komal", "Shruti", "Sanya", "Megha", "Ritika", "Akansha", "Deepak", "Anand", "Nitin", "Harsh", "Prateek", "Tarun"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Jain", "Mehta", "Bansal", "Agarwal"];
const BRANCHES = ["cs", "ec", "me", "ce", "ee", "it", "ch"];
const HOSTELS = ["H-Block-A", "H-Block-B", "H-Block-C", "G-Block-A", "G-Block-B"];

const MEAL_PRICES = { BREAKFAST: 40, LUNCH: 60, SNACKS: 20, DINNER: 60 };

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Wiping database (Transactions, Attendance, RewardLogs, Polls, Menus, Users)...");
  await prisma.rewardLog.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.mealAttendance.deleteMany({});
  await prisma.poll.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🌱 Simulating 50 Students...");
  const defaultPassword = await bcrypt.hash("Student@1234", 10);
  const managerPassword = await bcrypt.hash("Manager@1234", 10);

  // Users
  const usersToInsert = [
    {
      name: "Mess Manager",
      email: "manager@college.edu",
      password_hash: managerPassword,
      role: "MANAGER",
      hostel_id: "ADMIN",
    }
  ];

  for (let i = 0; i < 50; i++) {
    const fname = FIRST_NAMES[i % FIRST_NAMES.length];
    const lname = randomChoice(LAST_NAMES);
    const branch = randomChoice(BRANCHES);
    const year = "25";
    const email = `${fname.toLowerCase()}${lname[0].toLowerCase()}.${branch}.${year}@nitj.ac.in`;
    const isDefaulter = Math.random() < 0.15;

    usersToInsert.push({
      name: `${fname} ${lname}`,
      email: email,
      password_hash: defaultPassword,
      role: "STUDENT",
      hostel_id: randomChoice(HOSTELS),
      advance_paid: 15000,
      current_balance: isDefaulter ? -(Math.floor(Math.random() * 5000) + 100) : (Math.floor(Math.random() * 8000) + 2000),
      fee_due_status: isDefaulter,
      amount_due: isDefaulter ? 15000 : 0,
      reward_points: Math.floor(Math.random() * 200),
    });
  }

  // Insert users
  await prisma.user.createMany({ data: usersToInsert });
  const allStudents = await prisma.user.findMany({ where: { role: "STUDENT" } });
  console.log(`✅ Generated ${allStudents.length} simulated students & 1 manager.`);

  console.log("🌱 Generating 14 Days of Historical Activity (Polls & Attendance)...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalMeals = 0;
  let totalPolls = 0;
  let totalAttendance = 0;
  let totalRewards = 0;

  // offset: -14 to 1 (tomorrow)
  for (let offset = -14; offset <= 1; offset++) {
    const currentDay = new Date(today.getTime() + offset * 86400000);
    const y = currentDay.getFullYear(), m = currentDay.getMonth(), d = currentDay.getDate();

    const dailyMeals = [
      { type: "BREAKFAST", items: ["Poha", "Boiled Eggs", "Bread & Butter", "Chai"], hour: 8, cost: 40 },
      { type: "LUNCH", items: ["Rice", "Dal Tadka", "Mix Veg", "Roti", "Salad"], hour: 13, cost: 60 },
      { type: "SNACKS", items: ["Samosa", "Chai", "Biscuits"], hour: 17, cost: 20 },
      { type: "DINNER", items: ["Paneer Butter Masala", "Rice", "Roti", "Raita", "Gulab Jamun"], hour: 20, cost: 60 },
    ];

    for (const meal of dailyMeals) {
      const serve_time = new Date(y, m, d, meal.hour, 0, 0);
      const poll_cutoff_time = new Date(serve_time.getTime() - 4 * 60 * 60 * 1000);
      const isPastServe = serve_time < new Date();
      
      const menu = await prisma.menu.create({
        data: {
          meal_date: currentDay,
          meal_type: meal.type,
          items: JSON.stringify(meal.items),
          serve_time,
          poll_cutoff_time,
          rewards_processed: isPastServe, // Past meals are already processed
        }
      });
      totalMeals++;

      const isPastCutoff = poll_cutoff_time < new Date();

      if (isPastCutoff) {
        const attendanceData = [];
        const rewardLogsData = [];

        for (const student of allStudents) {
          const rand = Math.random();
          let intention = "NONE";
          
          if (rand < 0.75) intention = "YES";
          else if (rand < 0.90) intention = "NO";

          if (intention !== "NONE") {
            await prisma.poll.create({
              data: {
                student_id: student.id,
                menu_id: menu.id,
                intention,
                voted_at: new Date(poll_cutoff_time.getTime() - Math.floor(Math.random() * 3600000)),
              }
            });
            totalPolls++;

            if (intention === "YES") {
              // ~90% of YES voters actually attend
              if (Math.random() < 0.9 && isPastServe) {
                attendanceData.push({
                  student_id: student.id,
                  menu_id: menu.id,
                  deduction_amount: meal.cost,
                  scanned_at: new Date(serve_time.getTime() + Math.floor(Math.random() * 1800000)),
                });
                totalAttendance++;
              }
            } else if (intention === "NO" && isPastServe) {
              // ~85% genuinely skip → earn reward points
              if (Math.random() < 0.85) {
                const rewardPts = Math.round(meal.cost * 0.6);
                rewardLogsData.push({
                  student_id: student.id,
                  menu_id: menu.id,
                  points: rewardPts,
                  reason: "MEAL_SKIP_REWARD",
                });
                totalRewards++;
              } else {
                // ~15% show up despite saying NO (violation)
                attendanceData.push({
                  student_id: student.id,
                  menu_id: menu.id,
                  deduction_amount: meal.cost,
                  scanned_at: new Date(serve_time.getTime() + Math.floor(Math.random() * 1800000)),
                });
                totalAttendance++;
              }
            }
          }
        }

        if (attendanceData.length > 0) {
          await prisma.mealAttendance.createMany({ data: attendanceData });
        }
        if (rewardLogsData.length > 0) {
          await prisma.rewardLog.createMany({ data: rewardLogsData });
        }
      }
    }
  }

  // Update reward_points on users based on total reward logs
  const rewardSums = await prisma.rewardLog.groupBy({
    by: ['student_id'],
    _sum: { points: true },
  });

  for (const entry of rewardSums) {
    const totalPts = entry._sum.points || 0;
    await prisma.user.update({
      where: { id: entry.student_id },
      data: { reward_points: totalPts },
    });
  }

  console.log(`✅ Generated ${totalMeals} Meals.`);
  console.log(`✅ Generated ${totalPolls} Poll Votes.`);
  console.log(`✅ Generated ${totalAttendance} Physical Scans.`);
  console.log(`✅ Generated ${totalRewards} Reward Point Awards.`);
  
  console.log("\n🌱 Done! You can now log into manager@college.edu or any generated student.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
