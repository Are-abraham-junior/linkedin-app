import jwt from "jsonwebtoken";
import { prisma } from "../../../lib/prisma.js";
const JWT_SECRET = process.env.JWT_SECRET || "bime-link-super-secret-jwt-key-2026";
export function generateToken(user) {
    return jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        organizationId: user.organizationId,
    }, JWT_SECRET, { expiresIn: "7d" });
}
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "Non authentifié. Token requis." });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Logique de Supervision 360° pour Super Admin
        const impersonateOrgId = req.headers["x-impersonate-org"];
        if (impersonateOrgId && typeof impersonateOrgId === "string" && decoded.role === "SUPER_ADMIN") {
            const owner = await prisma.user.findFirst({
                where: { organizationId: impersonateOrgId, orgRole: "OWNER" },
            });
            req.user = {
                id: decoded.id, // Conserve l'identité et les droits du Super Admin
                email: decoded.email,
                role: "SUPER_ADMIN",
                name: decoded.name,
                organizationId: impersonateOrgId,
                ownerId: owner?.id || null,
                isImpersonating: true,
                originalSuperAdminId: decoded.id,
            };
            return next();
        }
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ success: false, error: "Session expirée ou token invalide." });
        return;
    }
}
export function requireSuperAdmin(req, res, next) {
    requireAuth(req, res, () => {
        const user = req.user;
        if (!user || (user.role !== "SUPER_ADMIN" && !user.originalSuperAdminId)) {
            res.status(403).json({ success: false, error: "Accès refusé. Privilèges Super Admin requis." });
            return;
        }
        next();
    });
}
