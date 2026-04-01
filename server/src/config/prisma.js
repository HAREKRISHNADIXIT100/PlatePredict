// src/config/prisma.js
const { PrismaClient } = require("@prisma/client");

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ log: ["error"] });
} else {
  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({ log: ["warn", "error"] });
  }
  prisma = global.__prismaClient;
}

module.exports = prisma;
