import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SentEmailRecord {
  to: string;
  subject: string;
  type: 'invitation' | 'password_reset';
  link: string;
  sentAt: Date;
  simulated: boolean;
  messageId?: string;
}

function escapeHtml(str: string): string {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] || c));
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null = null;
  private readonly fromEmail: string;
  private readonly sentHistory: SentEmailRecord[] = [];
  private static readonly MAX_HISTORY = 50;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Pointfex ERP <onboarding@resend.dev>';

    if (apiKey && apiKey.startsWith('re_')) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend client initialized successfully.');
    } else {
      this.logger.warn('RESEND_API_KEY not configured or placeholder detected. Operating in simulated/development mail mode.');
    }
  }

  private recordEmail(record: SentEmailRecord) {
    if (this.sentHistory.length >= MailService.MAX_HISTORY) {
      this.sentHistory.shift();
    }
    this.sentHistory.push(record);
  }

  getSentHistory(): SentEmailRecord[] {
    return [...this.sentHistory];
  }

  getLastSentEmail(): SentEmailRecord | undefined {
    return this.sentHistory[this.sentHistory.length - 1];
  }

  clearSentHistory(): void {
    this.sentHistory.length = 0;
  }

  async sendInvitationEmail(options: {
    to: string;
    inviteUrl: string;
    inviterName: string;
    role: string;
    expiresInHours?: number;
  }): Promise<{ success: boolean; simulated: boolean; messageId?: string }> {
    const { to, inviteUrl, inviterName, role, expiresInHours = 72 } = options;
    const safeInviter = escapeHtml(inviterName);
    const safeRole = escapeHtml(role);
    const subject = `You've been invited to join Pointfex ERP as a ${safeRole}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pointfex ERP Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: #0f172a; padding: 28px; text-align: center; border-bottom: 1px solid #334155; }
    .header h1 { margin: 0; font-size: 22px; color: #38bdf8; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; }
    .content p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0; }
    .highlight { color: #f8fafc; font-weight: 600; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px; }
    .notice { background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #fbbf24; margin-bottom: 24px; }
    .footer { padding: 20px 28px; background: #0f172a; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
    .break-link { word-break: break-all; color: #38bdf8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>POINTFEX VENTURE STUDIO</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><span class="highlight">${safeInviter}</span> from Studio Leadership has invited you to join Pointfex ERP as a <span class="highlight">${safeRole}</span>.</p>
      
      <div class="notice">
        <strong>Security Notice:</strong> This invitation link is unique to you and will expire in <strong>${expiresInHours} hours</strong>. If you do not set up your account within this window, a new invitation must be requested.
      </div>

      <p>Click the button below to set your developer password and activate your workspace:</p>

      <div class="btn-container">
        <a href="${inviteUrl}" class="btn" target="_blank">Set Password & Activate Account</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">If the button above does not work, copy and paste this link into your browser:</p>
      <p><a href="${inviteUrl}" class="break-link">${inviteUrl}</a></p>
    </div>
    <div class="footer">
      Pointfex ERP &copy; ${new Date().getFullYear()} Pointfex Venture Studio. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: this.fromEmail,
          to: [to],
          subject,
          html,
        });

        if (error) {
          this.logger.error(`Failed to send invitation email via Resend to ${to}: ${error.message}`);
          throw error;
        }

        const record: SentEmailRecord = {
          to,
          subject,
          type: 'invitation',
          link: inviteUrl,
          sentAt: new Date(),
          simulated: false,
          messageId: data?.id,
        };
        this.recordEmail(record);
        this.logger.log(`Invitation email dispatched via Resend to ${to} (Message ID: ${data?.id})`);
        return { success: true, simulated: false, messageId: data?.id };
      } catch (err) {
        this.logger.error(`Resend API error: ${(err as Error).message}. Falling back to simulation.`);
      }
    }

    // Simulated / Dev mode fallback
    const record: SentEmailRecord = {
      to,
      subject,
      type: 'invitation',
      link: inviteUrl,
      sentAt: new Date(),
      simulated: true,
    };
    this.recordEmail(record);
    this.logger.log(`[SIMULATED EMAIL] Invitation sent to ${to}. Invite Link: ${inviteUrl} (Expires in ${expiresInHours}h)`);
    return { success: true, simulated: true };
  }

  async sendPasswordResetEmail(options: {
    to: string;
    resetUrl: string;
    expiresInMinutes?: number;
  }): Promise<{ success: boolean; simulated: boolean; messageId?: string }> {
    const { to, resetUrl, expiresInMinutes = 60 } = options;
    const subject = `Reset your Pointfex ERP password`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: #0f172a; padding: 28px; text-align: center; border-bottom: 1px solid #334155; }
    .header h1 { margin: 0; font-size: 22px; color: #38bdf8; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; }
    .content p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: #ef4444; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px; }
    .notice { background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #fca5a5; margin-bottom: 24px; }
    .footer { padding: 20px 28px; background: #0f172a; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
    .break-link { word-break: break-all; color: #38bdf8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>POINTFEX VENTURE STUDIO</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset the password for your Pointfex ERP account.</p>
      
      <div class="notice">
        <strong>Security Notice:</strong> This link is only valid for <strong>${expiresInMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email.
      </div>

      <p>Click the button below to choose a new password:</p>

      <div class="btn-container">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">If the button above does not work, copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}" class="break-link">${resetUrl}</a></p>
    </div>
    <div class="footer">
      Pointfex ERP &copy; ${new Date().getFullYear()} Pointfex Venture Studio. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: this.fromEmail,
          to: [to],
          subject,
          html,
        });

        if (error) {
          this.logger.error(`Failed to send password reset email via Resend to ${to}: ${error.message}`);
          throw error;
        }

        const record: SentEmailRecord = {
          to,
          subject,
          type: 'password_reset',
          link: resetUrl,
          sentAt: new Date(),
          simulated: false,
          messageId: data?.id,
        };
        this.recordEmail(record);
        this.logger.log(`Password reset email dispatched via Resend to ${to} (Message ID: ${data?.id})`);
        return { success: true, simulated: false, messageId: data?.id };
      } catch (err) {
        this.logger.error(`Resend API error: ${(err as Error).message}. Falling back to simulation.`);
      }
    }

    // Simulated / Dev mode fallback
    const record: SentEmailRecord = {
      to,
      subject,
      type: 'password_reset',
      link: resetUrl,
      sentAt: new Date(),
      simulated: true,
    };
    this.recordEmail(record);
    this.logger.log(`[SIMULATED EMAIL] Password reset sent to ${to}. Reset Link: ${resetUrl} (Expires in ${expiresInMinutes}m)`);
    return { success: true, simulated: true };
  }
}
