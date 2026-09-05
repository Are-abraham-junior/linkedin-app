import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "bime-link-super-secret-jwt-key-2026";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  name?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
  isImpersonating?: boolean;
  originalSuperAdminId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Non authentifié. Token requis." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    
    // Logique de Supervision 360° pour Super Admin
    const impersonateOrgId = req.headers["x-impersonate-org"];
    if (impersonateOrgId && typeof impersonateOrgId === "string" && decoded.role === "SUPER_ADMIN") {
      const owner = await prisma.user.findFirst({
        where: { organizationId: impersonateOrgId, orgRole: "OWNER" },
      });

      req.user = {
        id: owner?.id || decoded.id, // ID effectif du propriétaire de l'espace supervisé
        email: owner?.email || decoded.email,
        role: "SUPER_ADMIN", // Conserve les prérogatives Super Admin
        name: owner?.name || decoded.name,
        organizationId: impersonateOrgId,
        ownerId: owner?.id || null,
        isImpersonating: true,
        originalSuperAdminId: decoded.id,
      };
      return next();
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: "Session expirée ou token invalide." });
    return;
  }
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const user = req.user as AuthenticatedUser & { originalSuperAdminId?: string };
    if (!user || (user.role !== "SUPER_ADMIN" && !user.originalSuperAdminId)) {
      res.status(403).json({ success: false, error: "Accès refusé. Privilèges Super Admin requis." });
      return;
    }
    next();
  });
}
