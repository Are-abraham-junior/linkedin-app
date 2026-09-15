import nodemailer, { Transporter } from "nodemailer";

/**
 * Service d'envoi d'emails transactionnels.
 *
 * IMPORTANT — contrainte d'hébergement LWS : le serveur ne peut effectuer de
 * connexions sortantes que sur les ports 80/443 (voir CLAUDE.md, section
 * "LWS blocks all outbound non-standard ports"). Un relais SMTP externe
 * classique (port 587/465) échouerait donc en production. On se connecte
 * donc en local (127.0.0.1:25) à la boîte mail cPanel hébergée sur la même
 * machine que l'application — cette connexion locale n'est pas concernée
 * par le blocage des ports sortants.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT) || 25;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    // Un relais local (127.0.0.1) n'exige souvent pas d'authentification,
    // mais certaines configurations cPanel le demandent même en local.
    auth: user && pass ? { user, pass } : undefined,
    ...(secure ? { tls: { rejectUnauthorized: false } } : {}),
  });

  return transporter;
}

interface SendTeamInvitationEmailParams {
  to: string;
  organizationName: string;
  invitedByName: string;
  inviteUrl: string;
  expiresAt: Date;
}

/**
 * Envoie l'email d'invitation à rejoindre un espace Bleadin.
 * Ne catch pas les erreurs : à l'appelant de décider quoi faire d'un échec
 * d'envoi (ex. annuler l'invitation créée en base plutôt que laisser un
 * enregistrement PENDING fantôme que le destinataire n'a jamais reçu).
 */
export async function sendTeamInvitationEmail(params: SendTeamInvitationEmailParams): Promise<void> {
  const { to, organizationName, invitedByName, inviteUrl, expiresAt } = params;
  const from = process.env.SMTP_FROM || "Bleadin <no-reply@bleadin.com>";
  const expiresLabel = expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const subject = `${invitedByName} vous invite à rejoindre ${organizationName} sur Bleadin`;

  const text = [
    `${invitedByName} vous invite à rejoindre l'espace "${organizationName}" sur Bleadin.`,
    "",
    `Créez votre compte pour rejoindre l'équipe : ${inviteUrl}`,
    "",
    "Vous pourrez ensuite connecter votre compte LinkedIn directement depuis l'application.",
    "",
    `Cette invitation expire le ${expiresLabel}.`,
  ].join("\n");

  const html = `
  <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f8f9fc; padding: 32px 16px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px rgba(89,46,255,0.08);">
      <div style="padding: 32px 32px 24px; text-align: center;">
        <div style="width: 48px; height: 48px; margin: 0 auto 20px; border-radius: 16px; background: linear-gradient(135deg, #592eff, #7c3aed); display: flex; align-items: center; justify-content: center;"></div>
        <h1 style="font-size: 20px; color: #21164c; margin: 0 0 12px;">Vous êtes invité·e sur Bleadin</h1>
        <p style="font-size: 14px; color: #5f5f69; line-height: 1.6; margin: 0 0 24px;">
          <strong>${invitedByName}</strong> vous invite à rejoindre l'espace
          <strong>${organizationName}</strong> sur Bleadin.
        </p>
        <a href="${inviteUrl}"
          style="display: inline-block; padding: 14px 28px; border-radius: 12px; background: linear-gradient(135deg, #592eff, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px;">
          Créer mon compte et rejoindre l'équipe
        </a>
        <p style="font-size: 12px; color: #5f5f69; line-height: 1.6; margin: 20px 0 0;">
          Vous pourrez ensuite connecter votre compte LinkedIn directement depuis l'application.
        </p>
        <p style="font-size: 12px; color: #9a9aa5; margin: 16px 0 0;">
          Cette invitation expire le ${expiresLabel}.
        </p>
        <p style="font-size: 11px; color: #b5b5bd; margin: 16px 0 0; word-break: break-all;">
          Si le bouton ne fonctionne pas, copiez ce lien : ${inviteUrl}
        </p>
      </div>
    </div>
  </div>`;

  await getTransporter().sendMail({ from, to, subject, text, html });
}

interface SendPasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}

/**
 * Envoie le lien de réinitialisation du mot de passe (valable 1 h).
 * Ne catch pas les erreurs : l'appelant répond 502 si l'e-mail ne part pas.
 */
export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
  const { to, name, resetUrl, expiresAt } = params;
  const from = process.env.SMTP_FROM || "Bleadin <no-reply@bleadin.com>";
  const expiresLabel = expiresAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const subject = "Réinitialisation de votre mot de passe Bleadin";

  const text = [
    `Bonjour ${name},`,
    "",
    "Vous avez demandé à réinitialiser votre mot de passe Bleadin.",
    `Choisissez un nouveau mot de passe via ce lien (valable 1 heure) : ${resetUrl}`,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : votre mot de passe reste inchangé.",
  ].join("\n");

  const html = `
  <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f8f9fc; padding: 32px 16px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px rgba(89,46,255,0.08);">
      <div style="padding: 32px 32px 24px; text-align: center;">
        <div style="width: 48px; height: 48px; margin: 0 auto 20px; border-radius: 16px; background: linear-gradient(135deg, #592eff, #7c3aed);"></div>
        <h1 style="font-size: 20px; color: #21164c; margin: 0 0 12px;">Réinitialiser votre mot de passe</h1>
        <p style="font-size: 14px; color: #5f5f69; line-height: 1.6; margin: 0 0 24px;">
          Bonjour <strong>${escapeHtml(name)}</strong>, vous avez demandé à réinitialiser votre mot de passe Bleadin.
          Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <a href="${resetUrl}"
          style="display: inline-block; padding: 14px 28px; border-radius: 12px; background: linear-gradient(135deg, #592eff, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px;">
          Choisir un nouveau mot de passe
        </a>
        <p style="font-size: 12px; color: #9a9aa5; margin: 20px 0 0;">
          Ce lien est valable 1 heure (jusqu'à ${expiresLabel} UTC) et ne peut être utilisé qu'une seule fois.
        </p>
        <p style="font-size: 12px; color: #5f5f69; line-height: 1.6; margin: 16px 0 0;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : votre mot de passe reste inchangé.
        </p>
        <p style="font-size: 11px; color: #b5b5bd; margin: 16px 0 0; word-break: break-all;">
          Si le bouton ne fonctionne pas, copiez ce lien : ${resetUrl}
        </p>
      </div>
    </div>
  </div>`;

  await getTransporter().sendMail({ from, to, subject, text, html });
}

interface ReportEmailCampaignRow {
  name: string;
  status: string;
  totalProspects: number;
  invitesSent: number;
  acceptanceRate: number;
  messagesSent: number;
  repliesReceived: number;
  replyRate: number;
}

interface ReportEmailKpi {
  label: string;
  value: string;
  delta: number | null;
}

interface SendCampaignReportEmailParams {
  to: string | string[];
  recipientName: string;
  frequencyLabel: string;
  periodLabel: string;
  previousPeriodLabel: string;
  kpis: ReportEmailKpi[];
  campaigns: ReportEmailCampaignRow[];
  reportsUrl: string;
  /** Fichiers PDF / Excel du rapport complet, joints à l'e-mail. */
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function deltaBadge(delta: number | null): string {
  if (delta === null) return `<span style="font-size:11px;color:#9a9aa5;">—</span>`;
  const up = delta >= 0;
  const color = up ? "#059669" : "#dc2626";
  return `<span style="font-size:11px;font-weight:700;color:${color};">${up ? "▲" : "▼"} ${Math.abs(delta)} %</span>`;
}

/**
 * Envoie le rapport périodique (quotidien / hebdomadaire) des campagnes :
 * résumé HTML dans le corps + rapport complet en pièces jointes (PDF et Excel,
 * générés par `reportExport.service.ts`).
 */
export async function sendCampaignReportEmail(params: SendCampaignReportEmailParams): Promise<void> {
  const from = process.env.SMTP_FROM || "Bleadin <no-reply@bleadin.com>";
  const subject = `Votre rapport ${params.frequencyLabel} Bleadin — ${params.periodLabel}`;

  const text = [
    `Bonjour ${params.recipientName},`,
    "",
    `Voici votre rapport ${params.frequencyLabel} de campagnes (${params.periodLabel}).`,
    "",
    ...params.kpis.map((k) => `- ${k.label} : ${k.value}${k.delta !== null ? ` (${k.delta >= 0 ? "+" : ""}${k.delta} % vs ${params.previousPeriodLabel})` : ""}`),
    "",
    ...params.campaigns.map(
      (c) =>
        `- ${c.name} [${c.status}] : ${c.totalProspects} prospects, ${c.invitesSent} invitations, ${c.acceptanceRate} % acceptées, ${c.messagesSent} messages, ${c.repliesReceived} réponses (${c.replyRate} %)`
    ),
    "",
    `Rapport complet (PDF / Excel) : ${params.reportsUrl}`,
  ].join("\n");

  const kpiCell = (k: ReportEmailKpi) => `
      <td style="padding:6px;width:50%;">
        <div style="background:#f8f9fc;border:1px solid #e0e0db;border-radius:14px;padding:12px 14px;">
          <div style="font-size:10px;font-weight:700;color:#5f5f69;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(k.label)}</div>
          <div style="font-size:20px;font-weight:800;color:#21164c;margin-top:4px;">${escapeHtml(k.value)}</div>
          <div style="margin-top:2px;">${deltaBadge(k.delta)} <span style="font-size:10px;color:#9a9aa5;">vs ${escapeHtml(params.previousPeriodLabel)}</span></div>
        </div>
      </td>`;

  // 2 KPI par ligne
  const kpiRows: string[] = [];
  for (let i = 0; i < params.kpis.length; i += 2) {
    kpiRows.push(`<tr>${kpiCell(params.kpis[i])}${params.kpis[i + 1] ? kpiCell(params.kpis[i + 1]) : "<td></td>"}</tr>`);
  }

  const campaignRows = params.campaigns.length
    ? params.campaigns
        .map(
          (c) => `
        <tr>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;font-weight:700;color:#21164c;">${escapeHtml(c.name)}<div style="font-size:10px;color:#9a9aa5;font-weight:500;">${escapeHtml(c.status)}</div></td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;">${c.totalProspects}</td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;">${c.invitesSent}</td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;color:#059669;font-weight:700;">${c.acceptanceRate} %</td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;">${c.messagesSent}</td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;">${c.repliesReceived}</td>
          <td style="padding:8px 10px;border-top:1px solid #f0f0ed;text-align:right;color:#592eff;font-weight:700;">${c.replyRate} %</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="padding:16px;text-align:center;color:#9a9aa5;">Aucune campagne sur la période.</td></tr>`;

  const logo = `<div style="width:48px;height:48px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#592eff,#7c3aed);"></div>`;

  const html = `
  <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;background-color:#f8f9fc;padding:32px 16px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(89,46,255,0.08);">
      <div style="padding:32px 32px 8px;text-align:center;">
        ${logo}
        <h1 style="font-size:20px;color:#21164c;margin:0 0 6px;">Votre rapport ${escapeHtml(params.frequencyLabel)}</h1>
        <p style="font-size:13px;color:#5f5f69;margin:0;">${escapeHtml(params.periodLabel)}</p>
      </div>
      <div style="padding:16px 26px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;">${kpiRows.join("")}</table>
      </div>
      <div style="padding:20px 32px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:12px;color:#353241;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8f9fc;font-size:10px;text-transform:uppercase;color:#5f5f69;">
              <th style="padding:8px 10px;text-align:left;">Campagne</th>
              <th style="padding:8px 10px;text-align:right;">Prospects</th>
              <th style="padding:8px 10px;text-align:right;">Invit.</th>
              <th style="padding:8px 10px;text-align:right;">Tx acc.</th>
              <th style="padding:8px 10px;text-align:right;">Msg</th>
              <th style="padding:8px 10px;text-align:right;">Rép.</th>
              <th style="padding:8px 10px;text-align:right;">Tx rép.</th>
            </tr>
          </thead>
          <tbody>${campaignRows}</tbody>
        </table>
      </div>
      <div style="padding:20px 32px 32px;text-align:center;">
        <div style="display:inline-block;padding:12px 20px;border-radius:12px;background:#f8f9fc;border:1px solid #e0e0db;font-size:12px;color:#21164c;text-align:left;">
          <div style="font-weight:700;margin-bottom:4px;">📎 Rapport complet en pièces jointes</div>
          ${params.attachments.map((a) => `<div style="color:#5f5f69;">• ${escapeHtml(a.filename)}</div>`).join("")}
        </div>
        <p style="font-size:11px;color:#b5b5bd;margin:16px 0 0;">
          Vous recevez cet e-mail car cette adresse a été configurée comme destinataire du rapport ${escapeHtml(params.frequencyLabel)} dans Bleadin › Rapports. Les destinataires, l'heure et le jour d'envoi se modifient à tout moment depuis <a href="${params.reportsUrl}" style="color:#592eff;">cette page</a>.
        </p>
      </div>
    </div>
  </div>`;

  await getTransporter().sendMail({ from, to: params.to, subject, text, html, attachments: params.attachments });
}
