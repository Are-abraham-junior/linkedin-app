/**
 * Utilitaire d'extraction intelligente de l'entreprise depuis le titre / headline LinkedIn.
 * Exemples de formats courants sur LinkedIn :
 * - "Commercial chez AIB" -> "AIB"
 * - "Chargé de clientèle chez Studely Togo" -> "Studely Togo"
 * - "Assistante Comptable chez NETIS-TOGO Licence en..." -> "NETIS-TOGO"
 * - "Responsable Communication @TIDD" -> "TIDD"
 * - "DIRECTRICE GÉNÉRALE À SPIRO-TOGO" -> "SPIRO-TOGO"
 * - "Country Director – CFAO Infrastructure" -> "CFAO Infrastructure"
 * - "Regional Manager CANAL+ TOGO" -> "CANAL+ TOGO"
 * - "CEO Kpelly Industries" -> "Kpelly Industries"
 * - "Responsable commerciale MPower Togo" -> "MPower Togo"
 */
export function extractCompanyFromHeadline(headline?: string | null): string {
  if (!headline || typeof headline !== "string") return "";
  const cleaned = headline.trim();
  if (!cleaned) return "";

  // 0. Explicit @Company (ex: @TIDD, @ Pierre Evan GROUP)
  const atMatch = cleaned.match(/(?:^|\s)@\s*([A-Za-z0-9À-ÿ&'’.\-+]+(?:\s+[A-Za-z0-9À-ÿ&'’.\-+]+)*)/);
  if (atMatch && atMatch[1]) {
    const comp = atMatch[1].split(/\s*[|•·/–—I]/)[0].trim();
    if (comp.length >= 2 && comp.length <= 50 && !/^(le|la|les|un|une|des)$/i.test(comp)) {
      return comp;
    }
  }

  // 1. Explicit markers: "chez", "at", "auprès de", "pour"
  const markerRegex = /(?:^|[\s.])(?:chez|at|auprès de|pour)\s+([A-Za-z0-9À-ÿ&'’.\-+]+(?:\s+[A-Za-z0-9À-ÿ&'’.\-+]+)*)/i;
  const markerMatch = cleaned.match(markerRegex);
  if (markerMatch && markerMatch[1]) {
    let comp = markerMatch[1].split(/\s+[|•·/–—I]|\s+(?:Licence|Master|Dipl[ôo]me|Stage|Formation|Tél|Tel|LinkedIn|Spécialiste|Consultant|Expert|Membre|Certifi[ée]|Étudiant|Etudiant|Directeur|Directrice|Responsable|Manager|Lead|CDI|CDD|Freelance|Indépendant)\b/i)[0].trim();
    comp = comp.replace(/[,;.]+$/, "").trim();
    if (comp.length >= 2 && comp.length <= 60 && !/^(le|la|les|un|une|des|mon|notre)$/i.test(comp)) {
      return comp;
    }
  }

  // 2. "à / À" suivi d'une entité en majuscules (ex: "DIRECTRICE GÉNÉRALE À SPIRO-TOGO", "Commercial BtoC à Yas Togo")
  const aRegex = /(?:^|\s)(?:à|À)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ&'’.\-+]+(?:\s+[A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ&'’.\-+]+)*)/;
  const aMatch = cleaned.match(aRegex);
  if (aMatch && aMatch[1]) {
    let comp = aMatch[1].split(/\s*[|•·/–—I]/)[0].trim().replace(/[,;.]+$/, "");
    if (comp.length >= 2 && comp.length <= 60 && !/^(temps|l['’]|la\s|le\s|votre|court|moyen|long|titre|pleinement|temps-plein)/i.test(comp)) {
      return comp;
    }
  }

  // 3. Sigles ou formes juridiques d'entreprises (ex: JNP TOGO SA, CFAO Green Infra B2B)
  const acronymRegex = /\b([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ&'’.\-+]{1,35}?\s+(?:SA|SAS|SARL|GIE|GROUP|GROUPE|INC|LLC|LTD|CORP|SOLUTIONS|HOLDING))\b/i;
  const acrMatch = cleaned.match(acronymRegex);
  if (acrMatch && acrMatch[1]) {
    let candidate = acrMatch[1].trim().replace(/^(?:directeur|responsable|chef|chargé|commercial|manager|marché|développement)\s+.*?de\s+/i, "");
    if (candidate.length >= 3 && candidate.length <= 50) {
      return candidate;
    }
  }

  // 4. Rôles de direction suivis du nom de l'entreprise (ex: "CEO Kpelly Industries", "Regional Manager CANAL+ TOGO")
  const roleMatch = cleaned.match(/(?:CEO|Fondateur|Founder|Co-Founder|Directeur Général|Directrice Générale|Regional Manager|Country Manager|Country Director)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,30}(?:\s+[A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,30})?)/i);
  if (roleMatch && roleMatch[1]) {
    const comp = roleMatch[1].split(/\s*[|•·/–—I]/)[0].trim();
    if (comp.length >= 2 && !/^(de|du|des|la|le|un|une|pays|togo|benin|ci|france)$/i.test(comp)) {
      return comp;
    }
  }

  // 5. Responsable commercial <Entreprise> (ex: "Responsable commerciale MPower Togo")
  const respMatch = cleaned.match(/(?:responsable commercial[e]?|commercial[e]?|conseiller clientèle)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,25}(?:\s+[A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,25})?)/i);
  if (respMatch && respMatch[1]) {
    const candidate = respMatch[1].split(/\s*[|•·/–—I]/)[0].trim();
    if (candidate.length >= 2 && !/^(terrain|b2b|b2c|junior|senior|export|togo|benin|france|maroc)$/i.test(candidate)) {
      return candidate;
    }
  }

  // 6. Segments délimités par | ou – ou I avec entreprises connues ou marques
  const parts = cleaned.split(/\s*[|•·–—I]\s*/);
  if (parts.length > 1) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      const brandMatch = p.match(/\b(CFAO|Orange|MTN|Moov|Société Générale|Ecobank|Total|Shell|Bolloré|Spiro|Studely|Canal\+|Yango|Wave|Lapaire|AIB|Coris|ESSEG|NETIS|Studely)\b(?:\s+[A-Za-z0-9À-ÿ+\-]+)*/i);
      if (brandMatch) {
        return brandMatch[0].trim();
      }
    }
    // Pattern: "Role – Company" (ex: "Country Director – CFAO Infrastructure")
    const first = parts[0].trim();
    const second = parts[1].trim();
    if (/^(country director|director|directeur|manager|ceo|founder|fondateur|co-founder|président|head of|vp|responsable|account manager)/i.test(first) && second.length >= 2 && second.length <= 40 && !second.includes("Togo") && !second.includes("Benin")) {
      return second;
    }
  }

  return "";
}
