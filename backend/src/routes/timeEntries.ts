/**
 * Time entries: listing, timer start/stop, manual entries, edit and delete.
 * An entry with `end === null` is the currently running timer.
 */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody, startRangeFilter } from "../lib/http";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/** Relations returned with every entry: its project (with client) and its tags. */
const include = {
  project: { include: { client: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.TimeEntryInclude;

type EntryWithRelations = Prisma.TimeEntryGetPayload<{ include: typeof include }>;

/** Flattens the `TimeEntryTag` join rows so the API returns `tags: Tag[]`. */
function serialize(entry: EntryWithRelations) {
  return { ...entry, tags: entry.tags.map((link) => link.tag) };
}

/** Join rows to create when attaching `tagIds` to an entry. */
function tagLinks(tagIds: string[]) {
  return { create: tagIds.map((tagId) => ({ tagId })) };
}

/** Finds an entry by id, scoped to the current user. */
function findOwnEntry(id: string, userId: string) {
  return prisma.timeEntry.findFirst({ where: { id, userId } });
}

// List entries, optionally restricted to those starting within [from, to]
router.get("/", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.userId!, start: startRangeFilter(from, to) },
    include,
    orderBy: { start: "desc" },
  });
  res.json(entries.map(serialize));
});

// Currently running entry, or null
router.get("/current", async (req: AuthRequest, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: req.userId!, end: null },
    include,
    orderBy: { start: "desc" },
  });
  res.json(entry ? serialize(entry) : null);
});

/** Fields shared by the timer-start and manual-entry payloads. */
const entryFields = {
  description: z.string().optional().default(""),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  billable: z.boolean().optional().default(false),
};

const startSchema = z.object(entryFields);

// Start a new timer (stops any currently running one first)
router.post("/start", async (req: AuthRequest, res) => {
  const data = parseBody(startSchema, req.body, res);
  if (!data) return;

  // Only one timer may run at a time
  const running = await prisma.timeEntry.findFirst({
    where: { userId: req.userId!, end: null },
  });
  if (running) {
    await prisma.timeEntry.update({
      where: { id: running.id },
      data: { end: new Date() },
    });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      description: data.description,
      projectId: data.projectId || null,
      billable: data.billable,
      start: new Date(),
      userId: req.userId!,
      tags: tagLinks(data.tagIds),
    },
    include,
  });
  res.status(201).json(serialize(entry));
});

// Stop a running timer
router.post("/:id/stop", async (req: AuthRequest, res) => {
  const entry = await findOwnEntry(req.params.id, req.userId!);
  if (!entry) return notFound(res);

  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { end: new Date() },
    include,
  });
  res.json(serialize(updated));
});

const manualSchema = z.object({
  ...entryFields,
  start: z.string(),
  end: z.string().nullable().optional(),
});

// Create a manual entry with explicit start/end times
router.post("/", async (req: AuthRequest, res) => {
  const data = parseBody(manualSchema, req.body, res);
  if (!data) return;

  const entry = await prisma.timeEntry.create({
    data: {
      description: data.description,
      projectId: data.projectId || null,
      billable: data.billable,
      start: new Date(data.start),
      end: data.end ? new Date(data.end) : null,
      userId: req.userId!,
      tags: tagLinks(data.tagIds),
    },
    include,
  });
  res.status(201).json(serialize(entry));
});

/** Every field optional: only the ones sent are updated. */
const updateSchema = z.object({
  description: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  billable: z.boolean().optional(),
  start: z.string().optional(),
  end: z.string().nullable().optional(),
});

// Edit an entry (partial update)
router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await findOwnEntry(req.params.id, req.userId!);
  if (!existing) return notFound(res);

  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;

  // When tags are sent they replace the previous set entirely
  if (data.tagIds) {
    await prisma.timeEntryTag.deleteMany({ where: { timeEntryId: existing.id } });
  }

  const updated = await prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      description: data.description,
      projectId: data.projectId,
      billable: data.billable,
      start: data.start ? new Date(data.start) : undefined,
      // `null` explicitly reopens the entry, `undefined` leaves it untouched
      end: data.end === undefined ? undefined : data.end ? new Date(data.end) : null,
      tags: data.tagIds ? tagLinks(data.tagIds) : undefined,
    },
    include,
  });
  res.json(serialize(updated));
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const entry = await findOwnEntry(req.params.id, req.userId!);
  if (!entry) return notFound(res);

  await prisma.timeEntry.delete({ where: { id: entry.id } });
  res.status(204).send();
});

export default router;
