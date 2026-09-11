import { prisma } from "../../../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

/**
 * Construit le filtre Prisma des ProspectList sur lesquelles l'utilisateur
 * courant a le droit d'ÉCRIRE (importer des prospects, déplacer vers, etc.).
 *
 * POURQUOI CE HELPER EXISTE
 * -------------------------
 * `getLists` montre à un OWNER d'organisation TOUTES les listes de son
 * organisation (`{ user: { organizationId } }`), alors que les contrôles
 * d'écriture se contentaient historiquement de `{ userId }` — les listes dont
 * l'utilisateur est personnellement propriétaire. Un OWNER voyait donc dans le
 * sélecteur la liste d'un coéquipier, la choisissait, et l'import échouait en
 * 404 « Liste cible non trouvée. » alors que la liste existait bel et bien.
 *
 * Les deux périmètres doivent rester cohérents : toute liste proposée dans
 * l'interface doit être une cible d'écriture valide. Passer par ce helper unique
 * empêche les deux règles de diverger à nouveau.
 *
 * Périmètre accordé, identique à la visibilité de `getLists` :
 *   - SUPER_ADMIN rattaché à une organisation → toutes les listes de l'organisation
 *   - OWNER d'une organisation                → toutes les listes de l'organisation
 *   - tout le reste (MEMBER, ADMIN, sans org) → ses propres listes uniquement
 */
export async function buildWritableListWhere(
  req: AuthenticatedRequest
): Promise<Record<string, any>> {
  const userId = req.user!.id;

  if (req.user!.role === "SUPER_ADMIN" && req.user!.organizationId) {
    return { user: { organizationId: req.user!.organizationId } };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, orgRole: true },
  });

  if (currentUser?.organizationId && currentUser.orgRole === "OWNER") {
    return { user: { organizationId: currentUser.organizationId } };
  }

  return { userId };
}
