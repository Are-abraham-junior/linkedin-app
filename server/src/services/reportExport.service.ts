import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { CampaignsReport, TimelinePoint } from "./report.service.js";

/**
 * Génération serveur des fichiers PDF / Excel du rapport de campagnes,
 * joints aux e-mails automatiques. Miroir de `client/src/utils/reportExport.ts`
 * (même mise en page, même contenu) mais renvoie des Buffers au lieu de
 * déclencher un téléchargement navigateur.
 */

export interface ExportableReport extends CampaignsReport {
  owner: { name: string; email: string; organizationName: string | null };
}

type ReportCampaign = CampaignsReport["campaigns"][number];

// ─── Libellés ────────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
  DRAFT: "Brouillon",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  INVITATION: "Invitation",
  MESSAGE: "Message",
  VISIT_PROFILE: "Visite de profil",
  VISIT: "Visite de profil",
  FOLLOW: "Suivi",
  DELAY: "Délai",
};

const PROSPECT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  WAITING_CONDITION: "Invitation envoyée",
  WAITING_DELAY: "Accepté – en cours",
  IN_PROGRESS: "En cours",
  REPLIED: "A répondu",
  COMPLETED: "Terminé",
  FAILED: "Échec",
};

const CONNECTION_LABELS: Record<string, string> = {
  CONNECTED: "En relation",
  PENDING: "En attente",
  NOT_CONNECTED: "Non connecté",
};

function fmtDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function fmtDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) +
        " " +
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function mergeTimelines(campaigns: ReportCampaign[]): TimelinePoint[] {
  const byDay = new Map<string, TimelinePoint>();
  for (const c of campaigns) {
    for (const p of c.timeline || []) {
      const cur = byDay.get(p.date) || { date: p.date, invitesSent: 0, messagesSent: 0, replies: 0 };
      cur.invitesSent += p.invitesSent;
      cur.messagesSent += p.messagesSent;
      cur.replies += p.replies;
      byDay.set(p.date, cur);
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Complète la série avec les jours sans activité (0) pour une courbe continue. */
function fillTimeline(points: TimelinePoint[], from: string, to: string): TimelinePoint[] {
  const byDay = new Map(points.map((p) => [p.date, p]));
  const out: TimelinePoint[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return points;
  if ((end.getTime() - start.getTime()) / 86400000 > 370) return points;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) || { date: key, invitesSent: 0, messagesSent: 0, replies: 0 });
  }
  return out;
}

/** « +12 % » / « -5 % » / « — » (ASCII : Helvetica du PDF n'a pas le glyphe U+2212). */
function fmtDelta(d: number | null | undefined): string {
  if (d === null || d === undefined) return "—";
  return `${d > 0 ? "+" : d < 0 ? "-" : ""}${Math.abs(d)} %`;
}

// ─── Excel ───────────────────────────────────────────────────────────────────

function autoWidth(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    const max = rows.reduce((m, r) => Math.max(m, String(r[k] ?? "").length), k.length);
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Information: "Aucune donnée" }]);
  ws["!cols"] = autoWidth(rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function buildReportExcel(report: ExportableReport, includeProspects: boolean): Buffer {
  const wb = XLSX.utils.book_new();
  const s = report.summary;
  const cmp = report.comparison || null;
  const prev = cmp?.summary;
  const dl = cmp?.deltas;
  const prevLabel = cmp ? `${fmtDate(cmp.period.from)} → ${fmtDate(cmp.period.to)}` : "—";

  const row = (label: string, value: unknown, previous?: number, d?: number | null) =>
    cmp
      ? { Indicateur: label, Valeur: value, "Période précédente": previous ?? "", Variation: previous === undefined ? "" : fmtDelta(d) }
      : { Indicateur: label, Valeur: value };

  addSheet(wb, "Résumé", [
    row("Généré le", fmtDateTime(report.generatedAt)),
    row("Période (actions)", `${fmtDate(report.period.from)} → ${fmtDate(report.period.to)}`),
    ...(cmp ? [row("Période de comparaison", prevLabel)] : []),
    row("Compte", report.owner.name),
    row("Organisation", report.owner.organizationName || "—"),
    row("Campagnes", s.campaigns),
    row("Campagnes actives", s.activeCampaigns),
    row("Prospects enrôlés", s.totalProspects),
    row("Invitations envoyées (période)", s.invitesSent, prev?.invitesSent, dl?.invitesSent),
    row("Invitations acceptées (cumul)", s.acceptedCount),
    row("Taux d'acceptation", `${s.acceptanceRate} %`),
    row("Messages envoyés (période)", s.messagesSent, prev?.messagesSent, dl?.messagesSent),
    row("Réponses reçues (période)", s.repliesReceived, prev?.repliesReceived, dl?.repliesReceived),
    row("Prospects ayant répondu (cumul)", s.repliedCount),
    row("Taux de réponse", `${s.replyRate} %`),
    row("Visites de profil (période)", s.visits, prev?.visits, dl?.visits),
    row("Suivis (période)", s.follows, prev?.follows, dl?.follows),
    row("Séquences terminées", s.completedCount),
    row("Actions en échec (période)", s.failedActions, prev?.failedActions, dl?.failedActions),
    row("Actions en file d'attente", s.queued),
  ]);

  addSheet(
    wb,
    "Campagnes",
    report.campaigns.map((c) => ({
      Campagne: c.name,
      Statut: CAMPAIGN_STATUS_LABELS[c.status] || c.status,
      Auteur: c.author?.name || "—",
      "Créée le": fmtDate(c.createdAt),
      Étapes: c.steps.length,
      Prospects: c.stats.totalProspects,
      "Invitations envoyées": c.stats.invitesSent,
      ...(cmp ? { "Invitations (préc.)": c.previousStats?.invitesSent ?? 0 } : {}),
      Acceptées: c.stats.acceptedCount,
      "Taux acceptation (%)": c.stats.acceptanceRate,
      "Messages envoyés": c.stats.messagesSent,
      ...(cmp ? { "Messages (préc.)": c.previousStats?.messagesSent ?? 0 } : {}),
      "Réponses reçues": c.stats.repliesReceived,
      ...(cmp ? { "Réponses (préc.)": c.previousStats?.repliesReceived ?? 0 } : {}),
      "Ont répondu": c.stats.repliedCount,
      "Taux réponse (%)": c.stats.replyRate,
      Visites: c.stats.visits,
      Suivis: c.stats.follows,
      Terminés: c.stats.completedCount,
      "En attente acceptation": c.stats.waitingCondition,
      "En cours de séquence": c.stats.waitingDelay,
      Échecs: c.stats.failed,
      "Actions en échec": c.stats.failedActions,
      "En file d'attente": c.stats.queued,
    }))
  );

  addSheet(
    wb,
    "Évolution",
    fillTimeline(mergeTimelines(report.campaigns), report.period.from, report.period.to).map((p) => ({
      Date: fmtDate(p.date),
      Invitations: p.invitesSent,
      Messages: p.messagesSent,
      Réponses: p.replies,
    }))
  );

  addSheet(
    wb,
    "Étapes",
    report.campaigns.flatMap((c) =>
      c.steps.map((st: any) => ({
        Campagne: c.name,
        Étape: st.stepOrder,
        Type: ACTION_TYPE_LABELS[st.actionType] || st.actionType,
        "Délai (jours)": st.delayDays,
        Message: st.messageText || "",
      }))
    )
  );

  if (includeProspects) {
    addSheet(
      wb,
      "Prospects",
      report.campaigns.flatMap((c) =>
        (c.prospects || []).map((p) => ({
          Campagne: c.name,
          Prénom: p.firstName,
          Nom: p.lastName,
          Entreprise: p.company || "",
          Titre: p.headline || "",
          Localisation: p.location || "",
          Email: p.email || "",
          Téléphone: p.phone || "",
          LinkedIn: p.linkedinUrl,
          Relation: CONNECTION_LABELS[p.connectionStatus] || p.connectionStatus,
          "Statut campagne": PROSPECT_STATUS_LABELS[p.status] || p.status,
          "Étape actuelle": p.currentStepOrder ?? "",
          "Enrôlé le": fmtDate(p.enrolledAt),
          "Dernière action": fmtDateTime(p.lastActionAt),
        }))
      )
    );
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const VIOLET: [number, number, number] = [89, 46, 255];
const NAVY: [number, number, number] = [33, 22, 76];
const MUTED: [number, number, number] = [95, 95, 105];
const BORDER: [number, number, number] = [224, 224, 219];
const CYAN: [number, number, number] = [46, 214, 255];
const PINK: [number, number, number] = [255, 89, 130];

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Dessine des courbes d'évolution avec les primitives jsPDF (pas de dépendance canvas). */
function drawTimelineChart(doc: jsPDF, y: number, points: TimelinePoint[]): number {
  const h = 55;
  const chartTop = y + 6;
  const chartBottom = chartTop + h;
  const legendY = chartBottom + 8;
  const plotLeft = MARGIN + 4;
  const plotW = CONTENT_W - 6;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, chartBottom, MARGIN + CONTENT_W, chartBottom);

  if (points.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Aucune activité sur la période.", MARGIN + CONTENT_W / 2, chartTop + h / 2, { align: "center" });
    return legendY + 4;
  }

  const max = Math.max(1, ...points.map((p) => Math.max(p.invitesSent, p.messagesSent, p.replies)));
  const series: Array<{ key: keyof Omit<TimelinePoint, "date">; color: [number, number, number] }> = [
    { key: "invitesSent", color: VIOLET },
    { key: "messagesSent", color: CYAN },
    { key: "replies", color: PINK },
  ];
  const xAt = (i: number) => (points.length === 1 ? plotLeft + plotW / 2 : plotLeft + (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => chartBottom - (v / max) * h;

  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  for (let i = 0; i <= 4; i++) {
    const gy = chartBottom - (h * i) / 4;
    doc.setDrawColor(240, 240, 237);
    doc.line(MARGIN, gy, MARGIN + CONTENT_W, gy);
    doc.text(String(Math.round((max * i) / 4)), MARGIN - 1.5, gy + 1, { align: "right" });
  }

  const every = Math.ceil(points.length / 12);
  points.forEach((p, i) => {
    if (i % every === 0 || i === points.length - 1) {
      doc.setTextColor(...MUTED);
      doc.text(p.date.slice(5).split("-").reverse().join("/"), xAt(i), chartBottom + 4, { align: "center" });
    }
  });

  for (const s of series) {
    const coords = points.map((p, i) => [xAt(i), yAt(p[s.key])] as [number, number]);
    if (points.length > 1) {
      const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
      if (gs) (doc as any).setGState(gs);
      doc.setFillColor(...s.color);
      const poly = [...coords, [coords[coords.length - 1][0], chartBottom], [coords[0][0], chartBottom]];
      const rel = poly.map((pt, i) => (i === 0 ? pt : [pt[0] - poly[i - 1][0], pt[1] - poly[i - 1][1]]));
      doc.lines(rel.slice(1) as any, poly[0][0], poly[0][1], [1, 1], "F", true);
      if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

      doc.setDrawColor(...s.color);
      doc.setLineWidth(0.7);
      doc.setLineJoin("round");
      for (let i = 1; i < coords.length; i++) {
        doc.line(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      }
    }
    doc.setFillColor(...s.color);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    const dotEvery = Math.ceil(points.length / 40);
    coords.forEach(([cx, cy], i) => {
      if (i % dotEvery === 0 || i === coords.length - 1) doc.circle(cx, cy, 0.9, "FD");
    });
  }

  let lx = MARGIN;
  const legend: Array<[string, [number, number, number]]> = [
    ["Invitations", VIOLET],
    ["Messages", CYAN],
    ["Réponses", PINK],
  ];
  doc.setFontSize(8);
  for (const [label, color] of legend) {
    doc.setFillColor(...color);
    doc.rect(lx, legendY - 2.5, 3, 3, "F");
    doc.setTextColor(...NAVY);
    doc.text(label, lx + 4.5, legendY);
    lx += doc.getTextWidth(label) + 12;
  }
  return legendY + 6;
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 1.8, MARGIN + 14, y + 1.8);
  return y + 8;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 18) {
    doc.addPage();
    return 20;
  }
  return y;
}

function kpiGrid(doc: jsPDF, y: number, items: Array<[string, string]>, cols = 4): number {
  const gap = 3;
  const w = (CONTENT_W - gap * (cols - 1)) / cols;
  const h = 17;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (w + gap);
    const yy = y + row * (h + gap);
    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, yy, w, h, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(item[0].toUpperCase(), x + 3, yy + 5.5);
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(item[1], x + 3, yy + 13);
  });
  const rows = Math.ceil(items.length / cols);
  return y + rows * (h + gap) + 2;
}

const tableBase = {
  theme: "grid" as const,
  margin: { left: MARGIN, right: MARGIN },
  styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.8, textColor: NAVY, lineColor: BORDER, lineWidth: 0.2 },
  headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
  alternateRowStyles: { fillColor: [251, 251, 254] as [number, number, number] },
};

function tableEndY(doc: jsPDF): number {
  return ((doc as any).lastAutoTable?.finalY ?? 20) + 8;
}

export function buildReportPdf(report: ExportableReport, includeProspects: boolean): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = report.summary;
  const cmp = report.comparison || null;
  const dl = cmp?.deltas;

  // ── En-tête ──
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, PAGE_W, 26, "F");
  const textX = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Bleadin — Rapport de campagnes", textX, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Période des actions : du ${fmtDate(report.period.from)} au ${fmtDate(report.period.to)}   •   Généré le ${fmtDateTime(report.generatedAt)}`,
    textX,
    17.5
  );
  doc.text(
    `${report.owner.name}${report.owner.organizationName ? "  •  " + report.owner.organizationName : ""}`,
    textX,
    22.5
  );

  const withDelta = (value: string, d: number | null | undefined) => (cmp ? `${value}   (${fmtDelta(d)})` : value);

  let y = 36;
  y = sectionTitle(doc, y, "Vue d'ensemble");
  y = kpiGrid(doc, y, [
    ["Campagnes", `${s.campaigns} (${s.activeCampaigns} actives)`],
    ["Prospects enrôlés", String(s.totalProspects)],
    ["Invitations envoyées", withDelta(String(s.invitesSent), dl?.invitesSent)],
    ["Taux d'acceptation", `${s.acceptanceRate} %`],
    ["Messages envoyés", withDelta(String(s.messagesSent), dl?.messagesSent)],
    ["Réponses reçues", withDelta(String(s.repliesReceived), dl?.repliesReceived)],
    ["Taux de réponse", `${s.replyRate} %`],
    ["Visites / Suivis", `${s.visits} / ${s.follows}`],
  ]);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "Les invitations/messages/réponses sont comptés sur la période ; les taux d'acceptation et de réponse sont cumulés depuis le lancement." +
      (cmp ? ` Variations calculées vs la période du ${fmtDate(cmp.period.from)} au ${fmtDate(cmp.period.to)}.` : ""),
    MARGIN,
    y + 1,
    { maxWidth: CONTENT_W }
  );
  y += cmp ? 11 : 8;

  y = sectionTitle(doc, y, "Activité sur la période");
  y = drawTimelineChart(doc, y, fillTimeline(mergeTimelines(report.campaigns), report.period.from, report.period.to));

  if (cmp) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, y, "Comparaison avec la période précédente");
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["Indicateur", `Du ${fmtDate(report.period.from)} au ${fmtDate(report.period.to)}`, `Du ${fmtDate(cmp.period.from)} au ${fmtDate(cmp.period.to)}`, "Variation"]],
      body: (
        [
          ["Invitations envoyées", "invitesSent"],
          ["Messages envoyés", "messagesSent"],
          ["Réponses reçues", "repliesReceived"],
          ["Visites de profil", "visits"],
          ["Suivis", "follows"],
          ["Actions en échec", "failedActions"],
        ] as Array<[string, keyof typeof cmp.summary]>
      ).map(([label, key]) => [label, s[key], cmp.summary[key], fmtDelta(dl?.[key])]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    });
    y = tableEndY(doc);
  }

  // ── Tableau des campagnes ──
  y = ensureSpace(doc, y + 2, 40);
  y = sectionTitle(doc, y, "Campagnes");
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [["Campagne", "Statut", "Prospects", "Invit.", "Acceptées", "Tx acc.", "Msg", "Réponses", "Tx rép.", "Terminés", "Échecs"]],
    body: report.campaigns.map((c) => [
      c.name,
      CAMPAIGN_STATUS_LABELS[c.status] || c.status,
      c.stats.totalProspects,
      c.stats.invitesSent,
      c.stats.acceptedCount,
      `${c.stats.acceptanceRate} %`,
      c.stats.messagesSent,
      c.stats.repliesReceived,
      `${c.stats.replyRate} %`,
      c.stats.completedCount,
      c.stats.failed + c.stats.failedActions,
    ]),
    columnStyles: { 0: { cellWidth: 46 } },
  });
  y = tableEndY(doc);

  // ── Détail par campagne ──
  for (const c of report.campaigns) {
    y = ensureSpace(doc, y, 60);
    y = sectionTitle(doc, y, c.name);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${CAMPAIGN_STATUS_LABELS[c.status] || c.status}  •  créée le ${fmtDate(c.createdAt)}  •  ${c.author?.name || ""}`,
      MARGIN,
      y
    );
    y += 5;
    y = kpiGrid(doc, y, [
      ["Prospects", String(c.stats.totalProspects)],
      ["Acceptées", `${c.stats.acceptedCount} (${c.stats.acceptanceRate} %)`],
      ["Ont répondu", `${c.stats.repliedCount} (${c.stats.replyRate} %)`],
      ["Terminés", String(c.stats.completedCount)],
      ["Invitations (période)", String(c.stats.invitesSent)],
      ["Messages (période)", String(c.stats.messagesSent)],
      ["Réponses (période)", String(c.stats.repliesReceived)],
      ["En attente / Échecs", `${c.stats.waitingCondition} / ${c.stats.failed}`],
    ]);

    if (c.steps.length) {
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["#", "Type", "Délai", "Message"]],
        body: c.steps.map((st: any) => [
          st.stepOrder,
          ACTION_TYPE_LABELS[st.actionType] || st.actionType,
          st.delayDays ? `${st.delayDays} j` : "—",
          (st.messageText || "").replace(/\s+/g, " ").slice(0, 220),
        ]),
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 14 } },
      });
      y = tableEndY(doc);
    }

    if (includeProspects && c.prospects && c.prospects.length) {
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["Prospect", "Entreprise", "Titre", "Statut", "Étape", "Dernière action"]],
        body: c.prospects.map((p) => [
          `${p.firstName} ${p.lastName}`.trim(),
          p.company || "",
          p.headline || "",
          PROSPECT_STATUS_LABELS[p.status] || p.status,
          p.currentStepOrder ?? "",
          fmtDateTime(p.lastActionAt),
        ]),
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 30 }, 3: { cellWidth: 28 }, 4: { cellWidth: 12 }, 5: { cellWidth: 26 } },
      });
      y = tableEndY(doc);
    }
  }

  // ── Pied de page ──
  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("Bleadin — rapport de campagnes", MARGIN, pageH - 8);
    doc.text(`Page ${i} / ${pages}`, PAGE_W - MARGIN, pageH - 8, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
