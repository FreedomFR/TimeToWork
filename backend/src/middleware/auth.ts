import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "30d";
// Only HS256 is ever issued; refusing any other algorithm rules out "alg" confusion tricks
const JWT_ALGORITHM = "HS256";

/** Secrets published in this repository / its docs: anyone can forge a session with them. */
const PLACEHOLDER_SECRETS = ["dev-secret-change-me", "change-me-in-production", "change-me"];
const MIN_SECRET_LENGTH = 32;

/** Express request enriched by `requireAuth` with the authenticated user's id. */
export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Route guard: expects `Authorization: Bearer <jwt>` and exposes the user id
 * as `req.userId`. Answers 401 when the header is missing or the token is
 * invalid/expired.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as { userId?: unknown };
    if (typeof payload.userId !== "string") throw new Error("Malformed token");
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Issues a session token for the given user. */
export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: JWT_ALGORITHM });
}

/**
 * Startup check of the signing secret. A guessable secret lets anyone mint a valid token for
 * any user id. With DEV_MODE off (an instance that is meant to be exposed) the server refuses
 * to start on such a secret; with DEV_MODE on (local development) it only warns.
 */
export function assertSafeJwtSecret() {
  const weak = PLACEHOLDER_SECRETS.includes(JWT_SECRET) || JWT_SECRET.length < MIN_SECRET_LENGTH;
  if (!weak) return;

  const message =
    "JWT_SECRET is a placeholder or shorter than 32 characters: sessions can be forged. " +
    "Generate one with `openssl rand -hex 32` and put it in .env.";
  if (process.env.NODE_ENV === "production" && process.env.DEV_MODE !== "true") {
    throw new Error(message);
  }
  console.warn(`[security] ${message}`);
}
