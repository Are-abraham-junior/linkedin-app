const testCases = [
  "Professionnelle de la comptabilité et de la finance.Assistante Comptable chez NETIS-TOGO Licence en Sciences Techniques Comptables & Financières (en cours),Maîtrise de QuickBooks & SAP",
  "#2 Branding & Positioning au Togo | Spécialiste Communication Marketing & Relation Client | Responsable Communication & Marketing, Relation Presse @TIDD | Je transforme l’écoute en engagement",
  "Cluster Manager Bénin & Togo chez Lapaire I Pilotage Stratégique multi-pays I P&L, performance commerciale & développement des talents I Leadership terrain, Afrique de l’Ouest",
  "Regional Manager CANAL+ TOGO",
  "CEO Kpelly Industries | On construit la 1ère usine de biscuits industriels du Togo | 100 000 cartons, une usine ! c’est maintenant.”",
  "Spécialiste en stratégies de Performance | Entreprises - Organisations - Startups | Initiatrice du programme de pré incubation ZENA | Responsable commerciale MPower Togo",
  "Responsable commercial chargé du développement du marché de lubrifiants et fuel JNP TOGO SA",
  "Driving Business Growth & Market Expansion | Operations Director | Togo & Benin",
  "Commercial chez AIB",
  "Chargé de clientèle chez Studely Togo",
  "DIRECTRICE GÉNÉRALE À SPIRO-TOGO",
  "Principal CEO @ Pierre Evan GROUP",
  "Commercial BtoC à Yas Togo | Chargé du Développement Commercial | Acquisition et Fidélisation Clients",
  "Country Director – CFAO Infrastructure | Togo & Benin | Membre du comité de direction de CFAO Green Infra B2B",
  "Etudiant en M1 Economie appliquée à ESSEG STATISTIQUE",
  "Commercial VN chez CFAO Motors Togo",
];

for (const tc of testCases) {
  console.log(`"${tc}"\n -> Company: "${extractCompany(tc)}"\n`);
}

export function extractCompany(headline) {
  if (!headline) return "";
  const cleaned = headline.trim();

  // 0. Handle explicit @Company (e.g. @TIDD, @ Pierre Evan GROUP)
  const atMatch = cleaned.match(/(?:^|\s)@\s*([A-Za-z0-9À-ÿ\s&'’.\-+]+?)(?=(?:\s*[|•·/–—I]|\s*$))/);
  if (atMatch && atMatch[1]) {
    const comp = atMatch[1].trim();
    if (comp.length >= 2 && comp.length <= 50 && !/^(le|la|les|un|une|des)$/i.test(comp)) {
      return comp;
    }
  }

  // 1. Explicit markers: "chez", "at", "auprès de", "pour"
  // Stop at typical delimiters or keywords like Licence, Master, Diplôme, Stage, etc.
  const markerRegex = /(?:^|[\s.])(?:chez|at|auprès de|pour)\s+([A-Za-z0-9À-ÿ\s&'’.\-+]+?)(?=(?:\s+[|•·/–—I]|(?:\s+(?:Licence|Master|Dipl[ôo]me|Stage|Formation|Tél|Tel|LinkedIn|Spécialiste|Consultant|Expert|Membre|Certifi[ée]|Étudiant|Etudiant|Directeur|Directrice|Responsable|Manager|Lead|CDI|CDD|Freelance|Indépendant))\b|\s*$))/i;
  const markerMatch = cleaned.match(markerRegex);
  if (markerMatch && markerMatch[1]) {
    let comp = markerMatch[1].trim();
    // Strip trailing punctuation
    comp = comp.replace(/[,;.]+$/, "").trim();
    if (comp.length >= 2 && comp.length <= 60 && !/^(le|la|les|un|une|des|mon|notre)$/i.test(comp)) {
      return comp;
    }
  }

  // 2. "à / À" followed by capitalized entity/company (e.g. "DIRECTRICE GÉNÉRALE À SPIRO-TOGO", "Commercial BtoC à Yas Togo")
  const aRegex = /(?:^|\s)(?:à|À)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ\s&'’.\-+]+?)(?=(?:\s*[|•·/–—I]|\s*$))/;
  const aMatch = cleaned.match(aRegex);
  if (aMatch && aMatch[1]) {
    let comp = aMatch[1].trim().replace(/[,;.]+$/, "");
    if (comp.length >= 2 && comp.length <= 60 && !/^(temps|l['’]|la\s|le\s|votre|court|moyen|long|titre|pleinement|temps-plein)/i.test(comp)) {
      return comp;
    }
  }

  // 3. Known Company patterns with acronyms (e.g. JNP TOGO SA)
  const acronymRegex = /\b([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ\s&'’.\-+]{1,35}?\s+(?:SA|SAS|SARL|GIE|GROUP|GROUPE|INC|LLC|LTD|CORP|SOLUTIONS|HOLDING))\b/i;
  const acrMatch = cleaned.match(acronymRegex);
  if (acrMatch && acrMatch[1]) {
    const candidate = acrMatch[1].trim().replace(/^(?:directeur|responsable|chef|chargé|commercial|manager|marché|développement)\s+.*?de\s+/i, "");
    if (candidate.length >= 3 && candidate.length <= 50) {
      return candidate;
    }
  }

  // 4. Role patterns like "CEO Kpelly Industries", "Regional Manager CANAL+ TOGO", "Responsable commerciale MPower Togo"
  const roleMatch = cleaned.match(/(?:CEO|Fondateur|Founder|Co-Founder|Directeur Général|Directrice Générale|Regional Manager|Country Manager|Country Director)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,30}(?:\s+[A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,30})?)(?=(?:\s*[|•·/–—I]|\s*$))/i);
  if (roleMatch && roleMatch[1]) {
    const comp = roleMatch[1].trim();
    if (comp.length >= 2 && !/^(de|du|des|la|le|un|une|pays|togo|benin)$/i.test(comp)) {
      return comp;
    }
  }

  // 5. Look for "Responsable commerciale/commercial <Company Name>" at segment end
  const respMatch = cleaned.match(/(?:responsable commercial[e]?|commercial[e]?|conseiller clientèle)\s+([A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,25}(?:\s+[A-Z0-9À-Ÿ][A-Za-z0-9À-ÿ+&'’.\-]{1,25})?)(?=(?:\s*[|•·/–—I]|\s*$))/i);
  if (respMatch && respMatch[1]) {
    const candidate = respMatch[1].trim();
    if (candidate.length >= 2 && !/^(terrain|b2b|b2c|junior|senior|export|togo|benin|france)$/i.test(candidate)) {
      return candidate;
    }
  }

  // 6. Look for segments separated by | or – or I
  const parts = cleaned.split(/\s*[|•·–—I]\s*/);
  if (parts.length > 1) {
    const first = parts[0].trim();
    const second = parts[1].trim();
    if (/^(country director|director|directeur|manager|ceo|founder|fondateur|co-founder|président|head of|vp|responsable|account manager)/i.test(first) && second.length >= 2 && second.length <= 40 && !second.includes("Togo") && !second.includes("Benin")) {
      return second;
    }
    // Check if any part contains known major firms
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      const brandMatch = p.match(/\b(CFAO|Orange|MTN|Moov|Société Générale|Ecobank|Total|Shell|Bolloré|Spiro|Studely|Canal\+|Yango|Wave|Lapaire|AIB|Coris)\b(?:\s+[A-Za-z0-9À-ÿ+]+)*/i);
      if (brandMatch) {
        return brandMatch[0].trim();
      }
    }
  }

  return "";
}

