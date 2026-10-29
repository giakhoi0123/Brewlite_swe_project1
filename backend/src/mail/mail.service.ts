import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { MailService, SendMailOptions } from './mail.types';

@Injectable()
export class NodemailerMailService implements MailService {
  private readonly logger = new Logger(NodemailerMailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = Number(process.env.SMTP_PORT || 1025);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.fromAddress = process.env.SMTP_FROM || 'no-reply@brewlite.vn';

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      if (!host || host === 'localhost' || host === '127.0.0.1' || host === 'mailpit') {
        throw new Error('Production environment requires a configured real SMTP provider.');
      }
      if (!user || !pass) {
        throw new Error('Production environment requires SMTP credentials (SMTP_USER, SMTP_PASS).');
      }
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    const subject = '[BrewLite] Yêu cầu đặt lại mật khẩu';
    const text = `Xin chào,\n\nBạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản BrewLite của bạn.\nVui lòng truy cập đường dẫn sau để tạo mật khẩu mới:\n${resetLink}\n\nLiên kết này có hiệu lực trong 15 phút và chỉ sử dụng được một lần.\nNếu bạn không yêu cầu điều này, xin vui lòng bỏ qua email.\n\nTrân trọng,\nĐội ngũ BrewLite`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1c1917; background-color: #fafaf9; border-radius: 8px;">
        <h2 style="color: #78350f; margin-top: 0;">BrewLite Coffee</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>${email}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background-color: #92400e; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Đặt lại mật khẩu</a>
        </p>
        <p style="color: #57534e; font-size: 14px;">Liên kết này có hiệu lực trong <strong>15 phút</strong> và chỉ sử dụng được <strong>một lần</strong>.</p>
        <p style="color: #57534e; font-size: 14px;">Nếu nút trên không hoạt động, bạn có thể sao chép liên kết sau vào trình duyệt:</p>
        <p style="color: #78716c; font-size: 12px; word-break: break-all;">${resetLink}</p>
        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 12px; margin-bottom: 0;">Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
      </div>
    `;

    await this.sendMail({
      to: email,
      subject,
      text,
      html,
    });

    // CRITICAL: DO NOT log token, password, or recovery link
    this.logger.log(`Password reset email sent successfully to ${email}`);
  }
}

