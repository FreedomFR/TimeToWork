/** Reports from the browser: JavaScript errors that happened on a user's screen. */
import { Router } from "express";
import { z } from "zod";
import { parseBody } from "../lib/http";
import { logEvent } from "../lib/logger";
import { clientLogLimiter } from "../lib/rateLimit";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const clientErrorSchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(4000).optional(),
  /** Address of the page where it happened. */
  url: z.string().max(500).optional(),
  kind: z.enum(["error", "unhandledrejection", "react"]).default("error"),
});

// Only signed-in users can report (an open endpoint would let anyone fill the journal), and
// each user is rate-limited. Everything is stored as text and shown escaped, never interpreted.
router.post("/client", clientLogLimiter, (req: AuthRequest, res) => {
  const data = parseBody(clientErrorSchema, req.body, res);
  if (!data) return;

  logEvent({
    level: "error",
    type: "client_error",
    message: data.message,
    method: "BROWSER",
    // Only the page path: the query string and fragment may hold sensitive values
    path: data.url?.split(/[?#]/)[0],
    userId: req.userId,
    details: { kind: data.kind, stack: data.stack },
  });
  res.status(204).send();
});

export default router;
