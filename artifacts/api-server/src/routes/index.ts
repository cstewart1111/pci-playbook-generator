import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playbooksRouter from "./playbooks";
import generationsRouter from "./generations";
import dashboardRouter from "./dashboard";
import hubspotRouter from "./hubspot";
import knowledgeRouter from "./knowledge";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/playbooks", playbooksRouter);
router.use("/generations", generationsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/hubspot", hubspotRouter);
router.use("/knowledge", knowledgeRouter);

export default router;
