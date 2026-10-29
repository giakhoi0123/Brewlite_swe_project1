import { jest } from '@jest/globals';
import { NodemailerMailService } from './mail.service';

describe('NodemailerMailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.SMTP_FROM = 'no-reply@brewlite.vn';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize successfully in non-production mode', () => {
    delete process.env.NODE_ENV;
    const service = new NodemailerMailService();
    expect(service).toBeDefined();
  });

  it('should throw error in production mode if SMTP host is localhost or mailpit', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'localhost';
    expect(() => new NodemailerMailService()).toThrow(
      'Production environment requires a configured real SMTP provider.',
    );
  });

  it('should throw error in production mode if credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.sendgrid.net';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(() => new NodemailerMailService()).toThrow(
      'Production environment requires SMTP credentials (SMTP_USER, SMTP_PASS).',
    );
  });

  it('should send password reset email via transporter', async () => {
    const service = new NodemailerMailService();
    const sendMailSpy = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({} as any);

    await service.sendPasswordResetEmail('user@test.vn', 'http://localhost:3000/reset-password?token=secret123');

    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const callArg = sendMailSpy.mock.calls[0][0];
    expect(callArg.to).toBe('user@test.vn');
    expect(callArg.subject).toContain('Yêu cầu đặt lại mật khẩu');
    expect(callArg.html).toContain('http://localhost:3000/reset-password?token=secret123');
  });
});
