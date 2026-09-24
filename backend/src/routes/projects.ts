/** Projects: CRUD, each optionally linked to a client. Scoped to the current user. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const DEFAULT_COLOR = "#03A9F4";

router.get("/", async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    include: { client: true },
    orderBy: { name: "asc" },
  });
  res.json(projects);
});

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
});

router.post("/", async (req: AuthRequest, res) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      color: data.color || DEFAULT_COLOR,
      clientId: data.clientId || null,
      userId: req.userId!,
    },
    include: { client: true },
  });
  res.status(201).json(project);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

router.put("/:id", async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!project) return notFound(res);

  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;

  // Only the fields actually sent are written, so two concurrent edits to
  // different fields (e.g. renaming while also changing the color) can't
  // clobber each other — a stale full-object read-modify-write would.
  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    include: { client: true },
  });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!project) return notFound(res);

  await prisma.project.delete({ where: { id: project.id } });
  res.status(204).send();
});

export default router;
