export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const MAIL_SERVICE = 'MAIL_SERVICE';

export interface MailService {
  sendMail(options: SendMailOptions): Promise<void>;
  sendPasswordResetEmail(email: string, resetLink: string): Promise<void>;
}

