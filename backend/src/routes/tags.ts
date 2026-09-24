import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const tags = await prisma.tag.findMany({
    where: { userId: req.userId! },
    orderBy: { name: "asc" },
  });
  res.json(tags);
});

const tagSchema = z.object({ name: z.string().min(1) });

router.post("/", async (req: AuthRequest, res) => {
  const parsed = tagSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tag = await prisma.tag.create({
    data: { name: parsed.data.name, userId: req.userId! },
  });
  res.status(201).json(tag);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const tag = await prisma.tag.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!tag) return res.status(404).json({ error: "Not found" });

  await prisma.tag.delete({ where: { id: tag.id } });
  res.status(204).send();
});

export default router;
