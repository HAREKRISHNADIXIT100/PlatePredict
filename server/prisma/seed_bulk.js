// prisma/seed_bulk.js
// Adds 50 students + 14 days of historical meal data with realistic poll patterns
// Run AFTER the initial seed. Does not touch existing data.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

const HOSTELS = ["H-Block-A", "H-Block-B", "H-Block-C", "G-Block-A", "G-Block-B"];
const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Myra", "Sara", "Aadhya", "Isha", "Kavya", "Riya", "Anika", "Nisha", "Rohan", "Karan", "Vikram", "Amit", "Deepak", "Suresh", "Manish", "Raj", "Nikhil", "Pranav", "Neha", "Pooja", "Shruti", "Meera", "Tanvi", "Sanya", "Pallavi", "Ritika", "Sneha", "Anjali", "Harsh", "Gaurav", "Sahil", "Tushar", "Varun", "Mohit", "Akash", "Rahul_B", "Priya_B", "Dev"];
const LAST_NAMES = ["Sharma", "Verma", "Patel", "Singh", "Kumar", "Gupta", "Joshi", "Rao", "Reddy", "Nair"];

const MENUS_BY_TYPE = {
  BREAKFAST: [
    ["Poha", "Chai", "Boiled Eggs"],
    ["Idli", "Sambar", "Chutney", "Coffee"],
    ["Paratha", "Curd", "Pickle", "Chai"],
    ["Upma", "Vada", "Chai", "Banana"],
    ["Bread", "Omelette", "Juice", "Butter"],
  ],
  LUNCH: [
    ["Rice", "Dal Tadka", "Aloo Gobi", "Roti", "Salad"],
    ["Rice", "Rajma", "Mix Veg", "Roti", "Raita"],
    ["Rice", "Chole", "Paneer", "Roti", "Pickle"],
    ["Biryani", "Raita", "Salan", "Salad"],
    ["Rice", "Sambar", "Bhindi Fry", "Roti", "Papad"],
  ],
  SNACKS: [
    ["Samosa", "Chai"],
    ["Pakora", "Chutney", "Chai"],
    ["Bread Pakora", "Chai"],
    ["Vada Pav", "Chai"],
    ["Biscuits", "Coffee"],
  ],
  DINNER: [
    ["Paneer Butter Masala", "Rice", "Roti", "Raita", "Gulab Jamun"],
    ["Chicken Curry", "Rice", "Naan", "Salad"],
    ["Dal Makhani", "Jeera Rice", "Roti", "Pickle", "Kheer"],
    ["Egg Curry", "Rice", "Roti", "Onion Salad"],
    ["Aloo Matar", "Rice", "Roti", "Raita", "Ice Cream"],
  ],
};

const MEAL_HOURS = { BREAKFAST: 8, LUNCH: 13, SNACKS: 17, DINNER: 20 };

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Bulk data seeder starting...\n");

  const passwordHash = await bcrypt.hash("Student@1234", 12);

  // ── 1. Create 50 students ─────────────────────────────────────────────────
  const students = [];
  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[i];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@college.edu`;
    const hostel = HOSTELS[i % HOSTELS.length];

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      students.push(existing);
      continue;
    }

    const advance = randomInt(12000, 18000);
    const balance = advance - randomInt(1000, 5000);
    const isDue = Math.random() < 0.15; // 15% chance of being a defaulter

    const student = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        password_hash: passwordHash,
        role: "STUDENT",
        hostel_id: hostel,
        advance_paid: advance,
        current_balance: isDue ? -randomInt(100, 800) : balance,
        fee_due_status: isDue,
        amount_due: isDue ? 15000 : 0,
      },
    });
    students.push(student);
  }
  console.log(`✅ ${students.length} students ready`);

  // Include existing seeded students
  const existingStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
  });
  const allStudents = existingStudents;
  console.log(`   Total students in DB: ${allStudents.length}`);

  // ── 2. Create 14 days of historical menus ──────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let menusCreated = 0;
  const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

  for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
    const day = new Date(today.getTime() - dayOffset * 86400000);

    for (const mealType of MEAL_TYPES) {
      // Check if menu already exists for this day+type
      const existCheck = await prisma.menu.findFirst({
        where: {
          meal_type: mealType,
          meal_date: { gte: day, lt: new Date(day.getTime() + 86400000) },
        },
      });
      if (existCheck) continue;

      const hour = MEAL_HOURS[mealType];
      const serveTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
      const cutoff = new Date(serveTime.getTime() - 4 * 60 * 60 * 1000);
      const itemOptions = MENUS_BY_TYPE[mealType];
      const items = itemOptions[randomInt(0, itemOptions.length - 1)];

      const menu = await prisma.menu.create({
        data: {
          meal_date: day,
          meal_type: mealType,
          items: JSON.stringify(items),
          serve_time: serveTime,
          poll_cutoff_time: cutoff,
        },
      });

      // ── 3. Generate realistic poll data ──────────────────────────────────
      // Different meals have different YES rates
      const yesRates = { BREAKFAST: 0.65, LUNCH: 0.85, SNACKS: 0.50, DINNER: 0.80 };
      const baseYesRate = yesRates[mealType];

      const pollData = [];
      for (const student of allStudents) {
        // Add some randomness: ±15%
        const willVoteYes = Math.random() < (baseYesRate + (Math.random() * 0.3 - 0.15));
        // Some students (10%) don't vote at all
        if (Math.random() < 0.10) continue;

        pollData.push({
          student_id: student.id,
          menu_id: menu.id,
          intention: willVoteYes ? "YES" : "NO",
        });
      }

      // Batch insert polls
      for (const p of pollData) {
        await prisma.poll.create({ data: p });
      }

      // ── 4. Generate meal attendance (actual show-ups) ────────────────────
      // Not everyone who voted YES actually shows up (the deviation!)
      // Deviation rates: Breakfast has highest no-show, lunch lowest
      const noShowRates = { BREAKFAST: 0.18, LUNCH: 0.08, SNACKS: 0.25, DINNER: 0.12 };
      const noShowRate = noShowRates[mealType];

      const yesVoters = pollData.filter((p) => p.intention === "YES");
      const deductionAmount = randomInt(30, 60); // per-meal cost

      for (const voter of yesVoters) {
        // Some YES voters don't show up (this creates the deviation)
        if (Math.random() < noShowRate) continue;

        await prisma.mealAttendance.create({
          data: {
            student_id: voter.student_id,
            menu_id: menu.id,
            deduction_amount: deductionAmount,
            scanned_at: new Date(serveTime.getTime() + randomInt(0, 30) * 60000),
          },
        });
      }

      // ── 5. Generate snack tokens for NO voters ───────────────────────────
      const noVoters = pollData.filter((p) => p.intention === "NO");
      for (const voter of noVoters) {
        const poll = await prisma.poll.findFirst({
          where: { student_id: voter.student_id, menu_id: menu.id },
        });
        if (!poll) continue;

        const tokenCode = `SNK-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const redeemed = Math.random() < 0.6; // 60% redeem their token

        await prisma.snackToken.create({
          data: {
            student_id: voter.student_id,
            poll_id: poll.id,
            token_code: tokenCode,
            status: redeemed ? "REDEEMED" : "EXPIRED",
            redeemed_at: redeemed ? new Date(serveTime.getTime() + randomInt(10, 60) * 60000) : null,
          },
        });
      }

      menusCreated++;
    }
    process.stdout.write(`\r   Day -${dayOffset}: ✅`);
  }

  console.log(`\n✅ ${menusCreated} historical menus with polls, attendance & tokens created`);

  // ── Summary ────────────────────────────────────────────────────────────────
  const [totalStudents, totalMenus, totalPolls, totalAttendance, totalTokens] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.menu.count(),
    prisma.poll.count(),
    prisma.mealAttendance.count(),
    prisma.snackToken.count(),
  ]);

  console.log(`\n📊 Database Summary:`);
  console.log(`   Students:       ${totalStudents}`);
  console.log(`   Menus:          ${totalMenus}`);
  console.log(`   Poll votes:     ${totalPolls}`);
  console.log(`   Attendance:     ${totalAttendance}`);
  console.log(`   Snack tokens:   ${totalTokens}`);
  console.log(`\n🌱 Bulk seed complete!`);
}

main()
  .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
