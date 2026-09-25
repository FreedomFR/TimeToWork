/**
 * Administration: user roles and the application journal. Every route requires an admin.
 * Being an admin is checked in the database on each request (see middleware/admin.ts).
 */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { LOG_LEVELS, LOG_TYPES, logEvent } from "../lib/logger";
import { dateField } from "../lib/schemas";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();
router.use(requireAuth, requireAdmin);

const MAX_USERS_LISTED = 500;

// ─── Users and roles ───────────────────────────────────────────────────────

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  _count: { select: { timeEntries: true } },
} satisfies Prisma.UserSelect;

function serializeUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
  const { _count, ...rest } = user;
  return { ...rest, entryCount: _count.timeEntries };
}

const usersQuery = z.object({ search: z.string().trim().max(100).optional() });

router.get("/users", async (req: AuthRequest, res) => {
  const query = parseBody(usersQuery, req.query, res);
  if (!query) return;

  const users = await prisma.user.findMany({
    where: query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: userSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: MAX_USERS_LISTED,
  });
  res.json(users.map(serializeUser));
});

const roleSchema = z.object({ role: z.enum(["USER", "ADMIN"]) });

/** Thrown inside the role-change transaction when it would leave the app without an admin. */
class LastAdminError extends Error {}

// Give or take away the admin role. The last remaining admin cannot be demoted, so the
// application can never end up without anyone able to manage roles.
router.put("/users/:id/role", async (req: AuthRequest, res) => {
  const data = parseBody(roleSchema, req.body, res);
  if (!data) return;

  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
  if (!target) return notFound(res, "Utilisateur introuvable");

  // Already in that state: nothing to do (and nothing to log)
  if (target.role === data.role) return res.json(serializeUser(target));

  try {
    // Serializable: two admins demoting each other at the same moment cannot both succeed
    await prisma.$transaction(
      async (tx) => {
        if (data.role === "USER") {
          const otherAdmins = await tx.user.count({ where: { role: "ADMIN", id: { not: target.id } } });
          if (otherAdmins === 0) throw new LastAdminError();
        }
        await tx.user.update({ where: { id: target.id }, data: { role: data.role } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof LastAdminError) {
      return res.status(400).json({ error: "Impossible de retirer le dernier administrateur" });
    }
    // Serialization failure: another role change ran concurrently
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return res.status(409).json({ error: "Modification simultanée, réessayez" });
    }
    throw err;
  }

  logEvent({
    level: "info",
    type: "admin_action",
    message: `Rôle de ${target.email} : ${target.role} → ${data.role}`,
    method: req.method,
    path: req.originalUrl.split("?")[0],
    statusCode: 200,
    userId: req.userId,
    details: { targetId: target.id, targetEmail: target.email, from: target.role, to: data.role },
  });

  const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: userSelect });
  res.json(serializeUser(updated));
});

// ─── Journal ───────────────────────────────────────────────────────────────

const MAX_PAGE_SIZE = 100;

const logsFilters = z.object({
  userId: z.string().uuid().optional(),
  type: z.enum(LOG_TYPES).optional(),
  level: z.enum(LOG_LEVELS).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
  /** Free text, searched in the message, the route, the account's email and the details. */
  q: z.string().trim().max(100).optional(),
});

const logsQuery = logsFilters.extend({
  sort: z.enum(["date", "user", "type", "level"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

function logsWhere(f: z.infer<typeof logsFilters>): Prisma.LogEntryWhereInput {
  return {
    userId: f.userId,
    type: f.type,
    level: f.level,
    createdAt: f.from || f.to ? { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined } : undefined,
    OR: f.q
      ? [
          { message: { contains: f.q, mode: "insensitive" } },
          { path: { contains: f.q, mode: "insensitive" } },
          { userEmail: { contains: f.q, mode: "insensitive" } },
          { details: { contains: f.q, mode: "insensitive" } },
        ]
      : undefined,
  };
}

// The journal, filtered, sorted and paginated. Ties are broken by date so pages are stable.
router.get("/logs", async (req: AuthRequest, res) => {
  const query = parseBody(logsQuery, req.query, res);
  if (!query) return;

  const orderBy: Prisma.LogEntryOrderByWithRelationInput[] =
    query.sort === "date"
      ? [{ createdAt: query.order }]
      : [{ [query.sort === "user" ? "userEmail" : query.sort]: query.order }, { createdAt: "desc" }];
  const where = logsWhere(query);

  const [total, items] = await Promise.all([
    prisma.logEntry.count({ where }),
    prisma.logEntry.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  res.json({
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  });
});

// How many entries of each type / level match the filters (except type and level themselves),
// for the counters above the journal.
router.get("/logs/summary", async (req: AuthRequest, res) => {
  const query = parseBody(logsFilters.omit({ type: true, level: true }), req.query, res);
  if (!query) return;
  const where = logsWhere(query);

  const [byType, byLevel] = await Promise.all([
    prisma.logEntry.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.logEntry.groupBy({ by: ["level"], where, _count: { _all: true } }),
  ]);

  res.json({
    types: LOG_TYPES,
    levels: LOG_LEVELS,
    byType: Object.fromEntries(byType.map((r) => [r.type, r._count._all])),
    byLevel: Object.fromEntries(byLevel.map((r) => [r.level, r._count._all])),
  });
});

export default router;
