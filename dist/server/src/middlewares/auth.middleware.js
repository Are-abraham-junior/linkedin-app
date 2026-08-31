import jwt from "jsonwebtoken";
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
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "Non authentifié. Token requis." });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        if (!req.user || req.user.role !== "SUPER_ADMIN") {
            res.status(403).json({ success: false, error: "Accès refusé. Privilèges Super Admin requis." });
            return;
        }
        next();
    });
}
