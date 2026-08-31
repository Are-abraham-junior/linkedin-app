import { Router } from "express";
import { getPlatformMetrics, getUsers, getUserDetails, createUser, updateUser, deleteUser, getOrganizations, } from "../controllers/admin.controller.js";
import { requireSuperAdmin } from "../middlewares/auth.middleware.js";
const router = Router();
// Toutes ces routes sont strictement protégées et réservées au SUPER_ADMIN
router.use(requireSuperAdmin);
router.get("/metrics", getPlatformMetrics);
router.get("/users", getUsers);
router.get("/users/:id", getUserDetails);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/organizations", getOrganizations);
export default router;
