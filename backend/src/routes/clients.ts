import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
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

const clientSchema = z.object({
  name: z.string().min(1),
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const client = await prisma.client.create({
    data: { name: parsed.data.name, userId: req.userId! },
  });
  res.status(201).json(client);
});

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  archived: z.boolean().optional(),
});

router.put("/:id", async (req: AuthRequest, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!client) return res.status(404).json({ error: "Not found" });

  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Only the fields actually sent are written — see the same fix on the
  // projects route for why a stale full-object read-modify-write is unsafe.
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      name: parsed.data.name,
      archived: parsed.data.archived,
    },
  });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!client) return res.status(404).json({ error: "Not found" });

  await prisma.client.delete({ where: { id: client.id } });
  res.status(204).send();
});

export default router;
