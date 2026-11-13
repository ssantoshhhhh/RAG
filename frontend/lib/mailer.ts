import nodemailer, { type Transporter } from "nodemailer";

interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  expiresMinutes?: number;
}

let transporter: Transporter | null = null;

function smtpPort(): number {
  const port = Number(process.env.SMTP_PORT ?? "587");
  return Number.isFinite(port) && port > 0 ? port : 587;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const port = smtpPort();
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && process.env.SMTP_USE_TLS !== "false",
    auth: username && password ? { user: username, pass: password } : undefined,
  });
  return transporter;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresMinutes = 30,
}: PasswordResetEmail): Promise<void> {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM is not configured");

  const text = [
    "We received a request to reset your DocuMind password.",
    `Open the link below within ${expiresMinutes} minutes:`,
    "",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Reset your DocuMind password</h2>
      <p style="margin: 0 0 12px;">
        We received a request to reset your DocuMind password.
        This link expires in ${expiresMinutes} minutes.
      </p>
      <p style="margin: 0 0 20px;">
        <a href="${resetUrl}"
           style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="margin: 0 0 8px; color: #475569; font-size: 13px;">
        If the button does not work, copy this link into your browser:
      </p>
      <p style="margin: 0 0 16px; word-break: break-all; font-size: 13px;">
        <a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a>
      </p>
      <p style="margin: 0; color: #64748b; font-size: 13px;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Reset your DocuMind password",
    text,
    html,
  });
}