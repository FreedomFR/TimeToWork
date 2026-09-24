import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    include: { client: true },
    orderBy: { name: "asc" },
  });
  res.json(projects);
});

const projectSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      color: parsed.data.color || "#03A9F4",
      clientId: parsed.data.clientId || null,
      userId: req.userId!,
    },
    include: { client: true },
  });
  res.status(201).json(project);
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

router.put("/:id", async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!project) return res.status(404).json({ error: "Not found" });

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Only the fields actually sent are written, so two concurrent edits to
  // different fields (e.g. renaming while also changing the color) can't
  // clobber each other — a stale full-object read-modify-write would.
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      clientId: parsed.data.clientId,
      archived: parsed.data.archived,
    },
    include: { client: true },
  });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!project) return res.status(404).json({ error: "Not found" });

  await prisma.project.delete({ where: { id: project.id } });
  res.status(204).send();
});

export default router;
