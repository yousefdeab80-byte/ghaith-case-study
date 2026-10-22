import "server-only";
import nodemailer from "nodemailer";

/**
 * الإرسال من السستم مباشرة بيشتغل لو اتظبطت إعدادات SMTP في متغيرات البيئة.
 * لـ Microsoft 365: SMTP_HOST=smtp.office365.com و SMTP_PORT=587، ولازم SMTP AUTH يكون مفعّل على الصندوق.
 */
export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendMail(msg: {
  from: string; to: string[]; cc: string[]; subject: string; text: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.8">${msg.text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
  await transport.sendMail({
    from: process.env.SMTP_FROM || msg.from, replyTo: msg.from,
    to: msg.to, cc: msg.cc.length ? msg.cc : undefined, subject: msg.subject, text: msg.text, html,
    attachments: msg.attachments,
  });
}
