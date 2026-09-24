import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const include = {
  project: { include: { client: true } },
  tags: { include: { tag: true } },
};

function serialize(entry: any) {
  return {
    ...entry,
    tags: entry.tags.map((t: any) => t.tag),
  };
}

// List entries, optionally filtered by date range
router.get("/", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: any = { userId: req.userId! };
  if (from || to) {
    where.start = {};
    if (from) where.start.gte = new Date(from);
    if (to) where.start.lte = new Date(to);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include,
    orderBy: { start: "desc" },
  });
  res.json(entries.map(serialize));
});

// Currently running entry (end === null)
router.get("/current", async (req: AuthRequest, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: req.userId!, end: null },
    include,
    orderBy: { start: "desc" },
  });
  res.json(entry ? serialize(entry) : null);
});

const startSchema = z.object({
  description: z.string().optional().default(""),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  billable: z.boolean().optional().default(false),
});

// Start a new timer (stops any currently running one first)
router.post("/start", async (req: AuthRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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
      description: parsed.data.description,
      projectId: parsed.data.projectId || null,
      billable: parsed.data.billable,
      start: new Date(),
      userId: req.userId!,
      tags: {
        create: parsed.data.tagIds.map((tagId) => ({ tagId })),
      },
    },
    include,
  });
  res.status(201).json(serialize(entry));
});

// Stop the currently running timer
router.post("/:id/stop", async (req: AuthRequest, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!entry) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { end: new Date() },
    include,
  });
  res.json(serialize(updated));
});

const manualSchema = z.object({
  description: z.string().optional().default(""),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  billable: z.boolean().optional().default(false),
  start: z.string(),
  end: z.string().nullable().optional(),
});

// Create a manual (already-completed) entry
router.post("/", async (req: AuthRequest, res) => {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const entry = await prisma.timeEntry.create({
    data: {
      description: parsed.data.description,
      projectId: parsed.data.projectId || null,
      billable: parsed.data.billable,
      start: new Date(parsed.data.start),
      end: parsed.data.end ? new Date(parsed.data.end) : null,
      userId: req.userId!,
      tags: {
        create: parsed.data.tagIds.map((tagId) => ({ tagId })),
      },
    },
    include,
  });
  res.status(201).json(serialize(entry));
});

const updateSchema = z.object({
  description: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  billable: z.boolean().optional(),
  start: z.string().optional(),
  end: z.string().nullable().optional(),
});

router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await prisma.timeEntry.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  if (data.tagIds) {
    await prisma.timeEntryTag.deleteMany({ where: { timeEntryId: existing.id } });
  }

  const updated = await prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      description: data.description,
      projectId: data.projectId !== undefined ? data.projectId : undefined,
      billable: data.billable,
      start: data.start ? new Date(data.start) : undefined,
      end: data.end !== undefined ? (data.end ? new Date(data.end) : null) : undefined,
      tags: data.tagIds
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include,
  });
  res.json(serialize(updated));
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!entry) return res.status(404).json({ error: "Not found" });

  await prisma.timeEntry.delete({ where: { id: entry.id } });
  res.status(204).send();
});

export default router;
