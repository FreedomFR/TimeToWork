import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Summary report: total duration grouped by project for a date range
router.get("/summary", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: any = { userId: req.userId!, end: { not: null } };
  if (from || to) {
    where.start = {};
    if (from) where.start.gte = new Date(from);
    if (to) where.start.lte = new Date(to);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { project: true },
  });

  const byProject = new Map<
    string,
    { projectId: string | null; name: string; color: string; seconds: number }
  >();

  let totalSeconds = 0;
  for (const entry of entries) {
    const seconds = Math.floor(
      (new Date(entry.end as Date).getTime() - new Date(entry.start).getTime()) / 1000
    );
    totalSeconds += seconds;
    const key = entry.projectId || "none";
    const current = byProject.get(key) || {
      projectId: entry.projectId,
      name: entry.project?.name || "Aucun projet",
      color: entry.project?.color || "#9CA3AF",
      seconds: 0,
    };
    current.seconds += seconds;
    byProject.set(key, current);
  }

  res.json({
    totalSeconds,
    byProject: Array.from(byProject.values()).sort((a, b) => b.seconds - a.seconds),
  });
});

export default router;
