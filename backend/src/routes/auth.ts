/**
 * Authentication: register / login, current user, password reset by email,
 * and the DEV_MODE passwordless login used during development.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { requireAuth, signToken, AuthRequest } from "../middleware/auth";
import { sendPasswordResetEmail } from "../lib/mailer";

const APP_URL = process.env.APP_URL || "http://localhost:8080";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;
// Same message for "unknown email" and "wrong password" so accounts can't be probed.
const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";

/** Read lazily (not cached at module load) so it can be toggled at runtime in tests. */
function isDevMode() {
  return process.env.DEV_MODE === "true";
}

/** Reset tokens are stored hashed: a database leak doesn't expose usable links. */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** The user fields that are safe to send to the client (never the password hash). */
function publicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

/** Standard `{ token, user }` payload returned by every login-like endpoint. */
function session(user: { id: string; email: string; name: string }) {
  return { token: signToken(user.id), user: publicUser(user) };
}

const router = Router();

// ─── Register / login ──────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const data = parseBody(registerSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return res.status(409).json({ error: "Cet email est déjà utilisé" });
  }

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      name: data.name,
    },
  });
  res.status(201).json(session(user));
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const data = parseBody(loginSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }
  res.json(session(user));
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return notFound(res, "User not found");
  res.json(publicUser(user));
});

// ─── Password reset ────────────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post("/forgot-password", async (req, res) => {
  const data = parseBody(forgotPasswordSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { email: data.email } });

  // Always respond the same way, whether or not the email is registered,
  // so this endpoint can't be used to enumerate accounts.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(token),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await sendPasswordResetEmail(user.email, `${APP_URL}/reset-password?token=${token}`);
  }

  res.json({
    message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
  });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

router.post("/reset-password", async (req, res) => {
  const data = parseBody(resetPasswordSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({
    where: { resetTokenHash: hashToken(data.token) },
  });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "Lien invalide ou expiré" });
  }

  // The token is single-use: it is cleared together with the password change
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
  res.json({ message: "Mot de passe mis à jour" });
});

// ─── DEV_MODE passwordless login ───────────────────────────────────────────
// Never enable DEV_MODE on an exposed instance: anyone could log in as anyone.
// Both routes answer 404 when it is off, as if they didn't exist.

router.get("/dev/users", async (_req, res) => {
  if (!isDevMode()) return notFound(res);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

const devLoginSchema = z.object({
  userId: z.string().min(1),
});

router.post("/dev/login", async (req, res) => {
  if (!isDevMode()) return notFound(res);

  const data = parseBody(devLoginSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) return notFound(res, "User not found");
  res.json(session(user));
});

export default router;
