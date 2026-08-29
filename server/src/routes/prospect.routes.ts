import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getProspects,
  bulkImportProspects,
  updateProspect,
  deleteProspect,
  bulkDeleteProspects,
  bulkMoveProspects,
} from "../controllers/prospect.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getProspects);
router.post("/bulk", bulkImportProspects);
router.post("/bulk-delete", bulkDeleteProspects);
router.post("/bulk-move", bulkMoveProspects);
router.put("/:id", updateProspect);
router.delete("/:id", deleteProspect);

export default router;
