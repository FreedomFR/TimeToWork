/**
 * Rate limiters for the endpoints an attacker would hammer: password guessing on login,
 * account creation, and email bombing through "forgot password".
 *
 * Counters live in memory (one backend process), keyed by client IP — and by email or user
 * where it matters, so one account can't be attacked from many addresses either.
 * `RATE_LIMIT_DISABLED=true` switches them all off (used by the automated tests).
 */
import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { AuthRequest } from "../middleware/auth";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

interface Options {
  windowMs: number;
  max: number;
  /** Extra part of the counter key besides the IP (an email, a user id…). */
  keyPart?: (req: Request) => string;
  /** Count only failed requests (status >= 400): successful logins don't use up the quota. */
  failuresOnly?: boolean;
}

function limiter({ windowMs, max, keyPart, failuresOnly = false }: Options) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly,
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req.ip ?? "");
      return keyPart ? `${ip}|${keyPart(req)}` : ip;
    },
    handler: (_req, res) => {
      res.status(429).json({ error: "Trop de tentatives, réessayez plus tard" });
    },
  });
}

const emailOf = (req: Request) => String(req.body?.email ?? "").toLowerCase();

/** Wrong passwords for one account, from one address. */
export const loginByAccountLimiter = limiter({ windowMs: 15 * MINUTE, max: 10, keyPart: emailOf, failuresOnly: true });
/** Wrong passwords from one address, whatever the account (spraying many emails). */
export const loginByIpLimiter = limiter({ windowMs: 15 * MINUTE, max: 100, failuresOnly: true });

export const registerLimiter = limiter({ windowMs: HOUR, max: 300 });

/** At most a few reset emails per address per hour, so nobody's inbox can be flooded. */
export const forgotPasswordByEmailLimiter = limiter({ windowMs: HOUR, max: 3, keyPart: emailOf });
export const forgotPasswordByIpLimiter = limiter({ windowMs: HOUR, max: 30 });

export const resetPasswordLimiter = limiter({ windowMs: 15 * MINUTE, max: 20 });

/** Wrong "current password" guesses by a signed-in user (keyed by user, run after `requireAuth`). */
export const changePasswordLimiter = limiter({
  windowMs: 15 * MINUTE,
  max: 10,
  keyPart: (req) => (req as AuthRequest).userId ?? "",
  failuresOnly: true,
});
