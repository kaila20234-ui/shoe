import nodemailer from 'nodemailer';

let transporter;

export async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) {
    console.info(`Mail to ${to}: ${subject}`);
    return;
  }
  try {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
    }
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
  } catch (error) {
    console.error('Unable to send email:', error);
  }
}
