// src/config/prisma.js
// Prisma Client singleton — prevents multiple instances during hot-reload.
// Every route file imports this: const prisma = require("../config/prisma");

const { PrismaClient } = require("@prisma/client");

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: ["error"],
  });
} else {
  // In development, reuse the client across hot-reloads
  if (!global.__prismaClient) {
    global.__prismaClient = new PrismaClient({
      log: ["query", "warn", "error"],
    });
  }
  prisma = global.__prismaClient;
}

module.exports = prisma;
