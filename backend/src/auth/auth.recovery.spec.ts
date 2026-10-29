import { jest } from '@jest/globals';
import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthRateLimiter } from './rate-limiter';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

describe('AuthService - Password Recovery & Change Password', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwt: any;
  let mockMailService: any;
  let rateLimiter: AuthRateLimiter;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user1@example.com',
    fullName: 'Test User',
    passwordHash: '',
    role: Role.CUSTOMER,
    status: UserStatus.ACTIVE,
    loyaltyPoints: 100,
    sessionVersion: 1,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('OldPassword123', 10);
  });

  beforeEach(() => {
    rateLimiter = new AuthRateLimiter();
    mockMailService = {
      sendMail: jest.fn().mockResolvedValue(undefined as never),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined as never),
    };
    mockJwt = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token' as never),
    };
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(mockPrisma)),
    };

    authService = new AuthService(mockPrisma, mockJwt, mockMailService, rateLimiter);
  });

  describe('forgotPassword', () => {
    it('returns generic success message and does not send email if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await authService.forgotPassword({ email: 'nonexistent@example.com' }, '127.0.0.1');

      expect(res.message).toContain('Nếu email tồn tại trong hệ thống');
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('generates a 32-byte token, stores only SHA-256 hash with 15m expiration, and sends email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({ id: 'token-uuid' });

      const res = await authService.forgotPassword({ email: 'user1@example.com' }, '127.0.0.1');

      expect(res.message).toContain('Nếu email tồn tại trong hệ thống');
      // Token is NOT returned in response
      expect((res as any).token).toBeUndefined();

      // Check that existing tokens were invalidated
      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });

      // Check created token record
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });

      const createArg = mockPrisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(createArg.tokenHash).toHaveLength(64); // SHA-256 hex is 64 chars

      // Check email was sent
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('enforces rate limiting on repeated requests by IP', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        await authService.forgotPassword({ email: `user${i}@example.com` }, '192.168.1.100');
      }

      await expect(
        authService.forgotPassword({ email: 'user99@example.com' }, '192.168.1.100'),
      ).rejects.toThrow(HttpException);
    });

    it('enforces rate limiting on repeated requests by account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      for (let i = 0; i < 3; i++) {
        await authService.forgotPassword({ email: 'target@example.com' }, `10.0.0.${i}`);
      }

      await expect(
        authService.forgotPassword({ email: 'target@example.com' }, '10.0.0.99'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException if token is missing or not found', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: 'invalid-token', newPassword: 'NewPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates password policy (min 8 chars, uppercase, digit)', async () => {
      const rawToken = 'a'.repeat(64);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        usedAt: null,
      });

      await expect(
        authService.resetPassword({ token: rawToken, newPassword: 'short' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        authService.resetPassword({ token: rawToken, newPassword: 'nouppercase123' }),
      ).rejects.toThrow('Mật khẩu phải có chữ hoa');

      await expect(
        authService.resetPassword({ token: rawToken, newPassword: 'NoDigitsHere' }),
      ).rejects.toThrow('Mật khẩu phải có chữ số');
    });

    it('resets password, increments sessionVersion, and marks tokens used in transaction', async () => {
      const rawToken = 'b'.repeat(64);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        usedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      const res = await authService.resetPassword({
        token: rawToken,
        newPassword: 'BrandNewPassword999',
      });

      expect(res.message).toContain('Đặt lại mật khẩu thành công');

      // Check sessionVersion incremented
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          sessionVersion: { increment: 1 },
          passwordHash: expect.any(String),
        }),
      });

      // Check token marked used
      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException if old password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword(mockUser.id, {
          oldPassword: 'WrongOldPassword123',
          newPassword: 'ValidNewPassword123',
        }),
      ).rejects.toThrow('Mật khẩu hiện tại không chính xác');
    });

    it('changes password, increments sessionVersion, and invalidates reset tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      const res = await authService.changePassword(mockUser.id, {
        oldPassword: 'OldPassword123',
        newPassword: 'NewValidPassword888',
      });

      expect(res.message).toBe('Đổi mật khẩu thành công');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          sessionVersion: { increment: 1 },
          passwordHash: expect.any(String),
        }),
      });

      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
    });

    it('throws UnauthorizedException if userId is missing', async () => {
      await expect(
        authService.changePassword('', {
          oldPassword: 'OldPassword123',
          newPassword: 'NewValidPassword888',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
