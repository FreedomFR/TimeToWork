/** Tags: list, create and delete, scoped to the current user. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parseBody } from "../lib/http";
import { nameField } from "../lib/schemas";
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

const createSchema = z.object({ name: nameField });

router.post("/", async (req: AuthRequest, res) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;

  const tag = await prisma.tag.create({
    data: { name: data.name, userId: req.userId! },
  });
  res.status(201).json(tag);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const tag = await prisma.tag.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!tag) return notFound(res);

  await prisma.tag.delete({ where: { id: tag.id } });
  res.status(204).send();
});

export default router;
