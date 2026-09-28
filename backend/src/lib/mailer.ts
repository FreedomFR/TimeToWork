/**
 * Outgoing emails: the password-reset link and the notice sent to the old address when an
 * account's email is changed. Without SMTP settings nothing is sent; what would have been
 * sent is logged to the console instead, which is enough for local use.
 */
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@timetowork.local";

const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

/** Escapes text for use inside an HTML email (addresses are typed by users). */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!transporter) {
    console.warn(
      `[mailer] SMTP not configured — reset link for ${to}: ${resetUrl}`
    );
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Réinitialisation de votre mot de passe TimeToWork",
    text: `Vous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien pour en choisir un nouveau (valable 1 heure) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `
      <p>Vous avez demandé la réinitialisation de votre mot de passe TimeToWork.</p>
      <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a> (lien valable 1 heure).</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });
}

/**
 * Warns the OLD address that the account now uses another one. If the change wasn't made by the
 * owner (someone with their session and password), this is how they find out.
 */
export async function sendEmailChangedNotice(oldEmail: string, newEmail: string) {
  if (!transporter) {
    console.warn(`[mailer] SMTP not configured — email-change notice for ${oldEmail} (new address: ${newEmail})`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: oldEmail,
    subject: "L'adresse email de votre compte TimeToWork a changé",
    text: `L'adresse email de votre compte TimeToWork est désormais ${newEmail}.\n\nVous ne pourrez plus vous connecter avec cette ancienne adresse.\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement un administrateur.`,
    html: `
      <p>L'adresse email de votre compte TimeToWork est désormais <strong>${escapeHtml(newEmail)}</strong>.</p>
      <p>Vous ne pourrez plus vous connecter avec cette ancienne adresse.</p>
      <p>Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement un administrateur.</p>
    `,
  });
}
