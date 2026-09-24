/** Clients: CRUD scoped to the current user. Deleting a client unlinks its projects. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const clients = await prisma.client.findMany({
    where: { userId: req.userId! },
    orderBy: { name: "asc" },
  });
  res.json(clients);
});

const createSchema = z.object({
  name: z.string().min(1),
});

router.post("/", async (req: AuthRequest, res) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;

  const client = await prisma.client.create({
    data: { name: data.name, userId: req.userId! },
  });
  res.status(201).json(client);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  archived: z.boolean().optional(),
});

router.put("/:id", async (req: AuthRequest, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!client) return notFound(res);

  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;

  // Only the fields actually sent are written — see the same note on the
  // projects route for why a stale full-object read-modify-write is unsafe.
  const updated = await prisma.client.update({ where: { id: client.id }, data });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!client) return notFound(res);

  await prisma.client.delete({ where: { id: client.id } });
  res.status(204).send();
});

export default router;
