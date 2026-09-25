/**
 * Authentication: register / login, current user, password change and reset by email,
 * and the DEV_MODE passwordless login used during development.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { requireAuth, signToken, AuthRequest } from "../middleware/auth";
import { sendPasswordResetEmail } from "../lib/mailer";
import {
  changePasswordLimiter,
  forgotPasswordByEmailLimiter,
  forgotPasswordByIpLimiter,
  loginByAccountLimiter,
  loginByIpLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from "../lib/rateLimit";
import { nameField, newPasswordField } from "../lib/schemas";

const APP_URL = process.env.APP_URL || "http://localhost:8080";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;
// Same message for "unknown email" and "wrong password" so accounts can't be probed.
const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";
const WRONG_CURRENT_PASSWORD = "Mot de passe actuel incorrect";
// Compared against when the email is unknown, so a login takes as long whether or not the
// account exists (otherwise response time would reveal which emails are registered).
const DUMMY_HASH = bcrypt.hashSync("unused-password-for-timing", BCRYPT_ROUNDS);

/** Read lazily (not cached at module load) so it can be toggled at runtime in tests. */
function isDevMode() {
  return process.env.DEV_MODE === "true";
}

/** Reset tokens are stored hashed: a database leak doesn't expose usable links. */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** The user fields that are safe to send to the client (never the password hash). */
function publicUser(user: { id: string; email: string; name: string; role: Role }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Standard `{ token, user }` payload returned by every login-like endpoint. */
function session(user: { id: string; email: string; name: string; role: Role }) {
  return { token: signToken(user.id), user: publicUser(user) };
}

const router = Router();

// ─── Register / login ──────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: newPasswordField,
  name: nameField,
});

router.post("/register", registerLimiter, async (req, res) => {
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
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

router.post("/login", loginByIpLimiter, loginByAccountLimiter, async (req, res) => {
  const data = parseBody(loginSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const passwordMatches = await bcrypt.compare(data.password, user ? user.password : DUMMY_HASH);
  if (!user || !passwordMatches) {
    // For the admin journal: who was targeted, never the password that was tried
    res.locals.log = {
      level: "warn",
      type: "auth_failed",
      message: user ? "Mot de passe incorrect" : "Email inconnu",
      userId: user?.id,
      userEmail: data.email,
    };
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }
  res.json(session(user));
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return notFound(res, "User not found");
  res.json(publicUser(user));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordField,
});

// Change the password of the signed-in user. The current password must be
// re-entered so a stolen session token alone can't take over the account.
router.post("/change-password", requireAuth, changePasswordLimiter, async (req: AuthRequest, res) => {
  const data = parseBody(changePasswordSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return notFound(res, "User not found");

  // Answers 400, not 401: the frontend treats any 401 as "session expired" and logs out
  if (!(await bcrypt.compare(data.currentPassword, user.password))) {
    res.locals.log = { level: "warn", type: "auth_failed", message: "Changement de mot de passe : mot de passe actuel incorrect" };
    return res.status(400).json({ error: WRONG_CURRENT_PASSWORD });
  }
  if (data.newPassword === data.currentPassword) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });
  }

  // Also cancels any pending reset link: it was issued for the old password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
  res.json({ message: "Mot de passe mis à jour" });
});

// ─── Password reset ────────────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

router.post("/forgot-password", forgotPasswordByIpLimiter, forgotPasswordByEmailLimiter, async (req, res) => {
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
  token: z.string().min(1).max(200),
  password: newPasswordField,
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const data = parseBody(resetPasswordSchema, req.body, res);
  if (!data) return;

  const user = await prisma.user.findUnique({
    where: { resetTokenHash: hashToken(data.token) },
  });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    res.locals.log = { level: "warn", type: "auth_failed", message: "Réinitialisation : lien invalide ou expiré" };
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
