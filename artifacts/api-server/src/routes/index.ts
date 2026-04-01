import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playbooksRouter from "./playbooks";
import generationsRouter from "./generations";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/playbooks", playbooksRouter);
router.use("/generations", generationsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
