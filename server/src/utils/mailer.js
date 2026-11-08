import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const smtpConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port || 587,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export async function sendMail({ to, subject, html }) {
  try {
    if (!transporter) {
      console.info('SMTP is not configured; email not sent:', { to, subject });
      return;
    }
    await transporter.sendMail({ from: config.mailFrom, to, subject, html });
  } catch (error) {
    console.error('Unable to send email:', error);
  }
}
