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
