/**
 * Time entries: listing, timer start/stop, manual entries, edit, merge and delete.
 * An entry with `end === null` is the currently running timer.
 */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody, startRangeFilter } from "../lib/http";
import { foreignReference } from "../lib/ownership";
import { dateField, dateRangeQuery, descriptionField, tagIdsField } from "../lib/schemas";
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
  const query = parseBody(dateRangeQuery, req.query, res);
  if (!query) return;

  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.userId!, start: startRangeFilter(query.from, query.to) },
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
  description: descriptionField.optional().default(""),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: tagIdsField.optional().default([]),
  billable: z.boolean().optional().default(false),
};

const startSchema = z.object(entryFields);

// Start a new timer (stops any currently running one first)
router.post("/start", async (req: AuthRequest, res) => {
  const data = parseBody(startSchema, req.body, res);
  if (!data) return;

  const problem = await foreignReference(req.userId!, { projectId: data.projectId, tagIds: data.tagIds });
  if (problem) return res.status(400).json({ error: problem });

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
  start: dateField,
  end: dateField.nullable().optional(),
});

// Create a manual entry with explicit start/end times
router.post("/", async (req: AuthRequest, res) => {
  const data = parseBody(manualSchema, req.body, res);
  if (!data) return;

  if (data.end && new Date(data.end) < new Date(data.start)) {
    return res.status(400).json({ error: "La fin doit être après le début" });
  }
  const problem = await foreignReference(req.userId!, { projectId: data.projectId, tagIds: data.tagIds });
  if (problem) return res.status(400).json({ error: problem });

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
  description: descriptionField.optional(),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: tagIdsField.optional(),
  billable: z.boolean().optional(),
  start: dateField.optional(),
  end: dateField.nullable().optional(),
});

// Edit an entry (partial update)
router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await findOwnEntry(req.params.id, req.userId!);
  if (!existing) return notFound(res);

  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;

  // Validate the resulting range, mixing the fields sent with those already stored
  const newStart = data.start ? new Date(data.start) : existing.start;
  const newEnd = data.end === undefined ? existing.end : data.end ? new Date(data.end) : null;
  if (newEnd && newEnd < newStart) {
    return res.status(400).json({ error: "La fin doit être après le début" });
  }
  const problem = await foreignReference(req.userId!, { projectId: data.projectId, tagIds: data.tagIds });
  if (problem) return res.status(400).json({ error: problem });

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

const mergeSchema = z.object({
  ids: z.array(z.string().uuid()).min(2).max(100),
});

/** What makes two entries "the same mission": merging them loses no information. */
function identityOf(entry: EntryWithRelations): string {
  const tagKey = entry.tags.map((link) => link.tagId).sort().join(",");
  return [entry.description, entry.projectId ?? "", entry.billable, tagKey].join("|");
}

// Merge several finished entries of the same mission into one. The earliest entry is kept
// and stretched to the latest end; the others are deleted, all in one transaction.
router.post("/merge", async (req: AuthRequest, res) => {
  const data = parseBody(mergeSchema, req.body, res);
  if (!data) return;

  const ids = Array.from(new Set(data.ids));
  if (ids.length < 2) return res.status(400).json({ error: "Il faut au moins deux créneaux à fusionner" });

  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: ids }, userId: req.userId! },
    include,
    orderBy: { start: "asc" },
  });
  // A missing id, or one belonging to someone else, is reported as not found
  if (entries.length !== ids.length) return notFound(res);

  if (entries.some((e) => e.end === null)) {
    return res.status(400).json({ error: "Un créneau en cours ne peut pas être fusionné" });
  }
  if (new Set(entries.map(identityOf)).size > 1) {
    return res
      .status(400)
      .json({ error: "Seuls des créneaux identiques (description, projet, balises, facturable) peuvent être fusionnés" });
  }

  const [kept, ...others] = entries;
  const latestEnd = new Date(Math.max(...entries.map((e) => e.end!.getTime())));

  const [merged] = await prisma.$transaction([
    prisma.timeEntry.update({ where: { id: kept.id }, data: { end: latestEnd }, include }),
    prisma.timeEntry.deleteMany({ where: { id: { in: others.map((e) => e.id) } } }),
  ]);
  res.json(serialize(merged));
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const entry = await findOwnEntry(req.params.id, req.userId!);
  if (!entry) return notFound(res);

  await prisma.timeEntry.delete({ where: { id: entry.id } });
  res.status(204).send();
});

export default router;
