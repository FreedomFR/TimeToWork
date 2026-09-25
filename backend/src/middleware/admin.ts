import { NextFunction, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "./auth";

/**
 * Route guard for administrators; use it after `requireAuth`.
 *
 * The role is read from the database on every call rather than from the session token, so
 * removing someone's admin role takes effect immediately, even for a token issued earlier.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
  if (user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Accès réservé aux administrateurs" });
  }
  next();
}
