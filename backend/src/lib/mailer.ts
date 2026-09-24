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
