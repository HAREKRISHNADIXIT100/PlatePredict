// src/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-me";

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, hostel_id: true, fee_due_status: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied." });
  }
  next();
};

const requireStudent = requireRole("STUDENT");
const requireManager = requireRole("MANAGER");

module.exports = { authenticate, requireRole, requireStudent, requireManager };
