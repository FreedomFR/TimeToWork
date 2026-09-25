/** Express application: middleware and route mounting (the HTTP server itself starts in index.ts). */
// Must come before the routes: makes Express 4 forward errors thrown in async handlers to the
// error middleware below. Without it a database error (or any bug) in an async route becomes an
// unhandled rejection that CRASHES the Node process — a denial of service for every user.
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import clientRoutes from "./routes/clients";
import tagRoutes from "./routes/tags";
import timeEntryRoutes from "./routes/timeEntries";
import reportRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";
import logRoutes from "./routes/logs";
import { AuthRequest } from "./middleware/auth";
import { requestLog } from "./middleware/requestLog";
import { logEvent } from "./lib/logger";

export const app = express();

// Authentication uses a Bearer token in a header (no cookies), so cross-origin requests
// cannot ride on a victim's session; open CORS is therefore acceptable here.
app.use(cors());
// Standard security headers, and no "X-Powered-By: Express" banner
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(requestLog);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/time-entries", timeEntryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/logs", logRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Last resort: never leak stack traces or database messages to the client
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: { type?: string; message?: string; stack?: string }, req: Request, res: Response, _next: NextFunction) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Payload too large" });

  console.error(err);
  // The client only gets a generic message; admins get the details in the journal
  logEvent({
    level: "error",
    type: "server_error",
    message: err.message ?? "Unknown error",
    method: req.method,
    path: req.originalUrl.split("?")[0],
    statusCode: 500,
    userId: (req as AuthRequest).userId,
    details: err.stack,
  });
  res.locals.logged = true;
  res.status(500).json({ error: "Internal server error" });
});
