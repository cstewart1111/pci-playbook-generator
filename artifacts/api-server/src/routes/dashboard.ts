import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playbooks, generations } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const [playbookCount] = await db.select({ count: count() }).from(playbooks);
    const [generationCount] = await db.select({ count: count() }).from(generations);
    const [emailCount] = await db
      .select({ count: count() })
      .from(generations)
      .where(eq(generations.type, "email"));
    const [scriptCount] = await db
      .select({ count: count() })
      .from(generations)
      .where(eq(generations.type, "script"));
    const [editsCount] = await db
      .select({ count: count() })
      .from(generations)
      .where(eq(generations.type, "edits"));

    const allPlaybooks = await db.select({ emailCount: playbooks.emailCount }).from(playbooks);
    const totalEmailsAnalyzed = allPlaybooks.reduce((sum, p) => sum + p.emailCount, 0);

    res.json({
      totalPlaybooks: Number(playbookCount.count),
      totalGenerations: Number(generationCount.count),
      totalEmailsAnalyzed,
      emailsGenerated: Number(emailCount.count),
      scriptsGenerated: Number(scriptCount.count),
      editsRequested: Number(editsCount.count),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.get("/recent-generations", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(10);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent generations");
    res.status(500).json({ error: "Failed to get recent generations" });
  }
});

export default router;
