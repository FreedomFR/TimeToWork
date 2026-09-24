import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken, AuthRequest } from "../middleware/auth";
import { sendPasswordResetEmail } from "../lib/mailer";

const APP_URL = process.env.APP_URL || "http://localhost:8080";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Read lazily (not cached at module load) so it can be toggled at runtime in tests.
function isDevMode() {
  return process.env.DEV_MODE === "true";
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Cet email est déjà utilisé" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
  });

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, name: user.name });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

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

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
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
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { resetTokenHash: hashToken(parsed.data.token) },
  });

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "Lien invalide ou expiré" });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  res.json({ message: "Mot de passe mis à jour" });
});

// Dev-only passwordless login, gated behind DEV_MODE — never enable this in production.
router.get("/dev/users", async (_req, res) => {
  if (!isDevMode()) return res.status(404).json({ error: "Not found" });

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
  if (!isDevMode()) return res.status(404).json({ error: "Not found" });

  const parsed = devLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
