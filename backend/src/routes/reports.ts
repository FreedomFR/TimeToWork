/** Server-side aggregated reports. */
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { parseBody, startRangeFilter } from "../lib/http";
import { dateRangeQuery } from "../lib/schemas";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/** Color used for entries without a project. */
const NO_PROJECT_COLOR = "#9CA3AF";

interface ProjectTotal {
  projectId: string | null;
  name: string;
  color: string;
  seconds: number;
}

// Summary report: total duration grouped by project for a date range.
// Running timers (no end yet) are excluded.
router.get("/summary", async (req: AuthRequest, res) => {
  const query = parseBody(dateRangeQuery, req.query, res);
  if (!query) return;

  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.userId!, end: { not: null }, start: startRangeFilter(query.from, query.to) },
    include: { project: true },
  });

  const byProject = new Map<string, ProjectTotal>();
  let totalSeconds = 0;

  for (const entry of entries) {
    const seconds = Math.floor((entry.end!.getTime() - entry.start.getTime()) / 1000);
    totalSeconds += seconds;

    const key = entry.projectId || "none";
    const current = byProject.get(key) || {
      projectId: entry.projectId,
      name: entry.project?.name || "Aucun projet",
      color: entry.project?.color || NO_PROJECT_COLOR,
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
