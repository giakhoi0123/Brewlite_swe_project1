import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { jest } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MAIL_SERVICE } from '../src/mail/mail.types';

type TestUser = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  loyaltyPoints: number;
  role: Role;
  status: UserStatus;
  sessionVersion: number;
};

type TestResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

let app: INestApplication;
let users: TestUser[];
let resetTokens: TestResetToken[];
let sentMails: Array<{ to: string; resetLink: string }>;
let jwt: JwtService;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-long-enough-for-rbac-tests';
  resetTokens = [];
  sentMails = [];
  users = [
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'staff@example.com',
      fullName: 'Staff',
      passwordHash: await bcrypt.hash('Password123', 10),
      loyaltyPoints: 0,
      role: Role.BARISTA,
      status: UserStatus.ACTIVE,
      sessionVersion: 0,
    },
  ];
  const prisma: any = {
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { email?: string; id?: string } }) =>
          users.find((user) =>
            where.email ? user.email === where.email : user.id === where.id,
          ) ?? null,
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            email: string;
            fullName: string;
            passwordHash: string;
            role: Role;
          };
        }) => {
          const user: TestUser = {
            id: '00000000-0000-0000-0000-000000000001',
            ...data,
            loyaltyPoints: 0,
            status: UserStatus.ACTIVE,
            sessionVersion: 0,
          };
          users.push(user);
          return user;
        },
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data?: any }) => {
        const user = users.find((item) => item.id === where.id);
        if (!user) throw new Error('User not found');
        if (data?.sessionVersion?.increment) {
          user.sessionVersion += data.sessionVersion.increment;
        } else {
          user.sessionVersion += 1;
        }
        if (data?.passwordHash) {
          user.passwordHash = data.passwordHash;
        }
        return user;
      }),
    },
    passwordResetToken: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          resetTokens.find((t) => {
            if (where.tokenHash && t.tokenHash !== where.tokenHash) return false;
            if (where.usedAt === null && t.usedAt !== null) return false;
            if (where.expiresAt?.gt && t.expiresAt <= where.expiresAt.gt) return false;
            return true;
          }) ?? null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const token: TestResetToken = {
          id: `token-${Date.now()}-${Math.random()}`,
          usedAt: null,
          createdAt: new Date(),
          ...data,
        };
        resetTokens.push(token);
        return token;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const token = resetTokens.find((t) => t.id === where.id);
        if (token) Object.assign(token, data);
        return token;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of resetTokens) {
          if (where.userId && token.userId !== where.userId) continue;
          if (where.usedAt === null && token.usedAt !== null) continue;
          Object.assign(token, data);
          count++;
        }
        return { count };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const mockMailService = {
    sendMail: jest.fn(),
    sendPasswordResetEmail: jest.fn(async (email: string, resetLink: string) => {
      sentMails.push({ to: email, resetLink });
    }),
  };

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MAIL_SERVICE)
    .useValue(mockMailService)
    .compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  jwt = module.get(JwtService);
});

afterAll(async () => {
  await app.close();
});

describe('RBAC authentication', () => {
  it('registers a CUSTOMER and rejects a supplied role', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Fake Staff',
        email: 'fake@example.com',
        password: 'Password123',
        role: 'BARISTA',
      })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Customer',
        email: 'Customer@Example.COM',
        password: 'Password123',
      })
      .expect(201);
    expect(response.body.user.role).toBe(Role.CUSTOMER);
    expect(response.body.user.email).toBe('customer@example.com');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(
      users.find((user) => user.email === 'customer@example.com')?.role,
    ).toBe(Role.CUSTOMER);
    expect(
      await bcrypt.compare(
        'Password123',
        users.find((user) => user.email === 'customer@example.com')!
          .passwordHash,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Customer',
        email: 'CUSTOMER@example.com',
        password: 'Password123',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Invalid', email: 'not-an-email', password: 'Password123' })
      .expect(400);
  });

  it('logs in both roles and restores a cookie session', async () => {
    for (const [email, role] of [
      ['customer@example.com', Role.CUSTOMER],
      ['staff@example.com', Role.BARISTA],
    ] as const) {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123' })
        .expect(201);
      expect(login.body.user.role).toBe(role);
      expect(login.headers['cache-control']).toBe('no-store');
      expect(login.body.accessToken).toBeUndefined();
      expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', login.headers['set-cookie'])
        .expect(200);
      expect(me.body.user.role).toBe(role);
      expect(me.headers['cache-control']).toBe('no-store');
      const loggedOut = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', login.headers['set-cookie'])
        .expect(201);
      expect(loggedOut.headers['set-cookie'][0]).toContain(
        'Expires=Thu, 01 Jan 1970',
      );
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', login.headers['set-cookie'])
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'WrongPassword123' })
      .expect(401);
  });

  it('US-04: JWT issued at login carries userId and role', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123' }).expect(201);
    const token = login.headers['set-cookie'][0].split(';')[0].split('=')[1];
    expect(jwt.decode(token)).toMatchObject({ userId: users[0].id, role: Role.BARISTA });
  });

  it('requires valid authentication and current BARISTA role', async () => {
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired = await jwt.signAsync(
      { sub: users[0].id },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    const customer = users.find((user) => user.role === Role.CUSTOMER)!;
    const forgedRole = await jwt.signAsync({
      sub: customer.id,
      role: Role.BARISTA,
      sessionVersion: customer.sessionVersion,
    });
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', `Bearer ${forgedRole}`)
      .expect(403);
    const staffToken = await jwt.signAsync({
      sub: users[0].id,
      sessionVersion: users[0].sessionVersion,
    });
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('rejects malformed registration and login payloads without leaking secrets', async () => {
    for (const body of [
      {},
      { name: 'A', email: 'invalid', password: 'Password123' },
      { name: 'Valid Name', email: 'person@example.com', password: 'weak' },
      { name: 'Valid Name', email: 'person@example.com', password: 'Password123', role: 'BARISTA' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register').send(body).expect(400);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    }
    await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: "' OR 1=1 --", password: 'Password123' }).expect(400);
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' }).expect(401);
  });

  it('rejects tampered and incorrectly signed JWTs', async () => {
    const valid = await jwt.signAsync({
      sub: users[0].id,
      sessionVersion: users[0].sessionVersion,
    });
    await request(app.getHttpServer()).get('/api/auth/me')
      .set('Authorization', `Bearer ${valid.slice(0, -2)}xx`).expect(401);
    const wrongSignature = await jwt.signAsync(
      { sub: users[0].id, sessionVersion: users[0].sessionVersion },
      { secret: 'another-test-secret-long-enough' },
    );
    await request(app.getHttpServer()).get('/api/auth/me')
      .set('Authorization', `Bearer ${wrongSignature}`).expect(401);
  });

  describe('Password Recovery and Change Password flows', () => {
    it('handles forgot-password for non-existing email without leaking user existence', async () => {
      const initialMailCount = sentMails.length;
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(201);

      expect(res.body.message).toContain('Nếu email tồn tại trong hệ thống');
      expect(sentMails.length).toBe(initialMailCount);
    });

    it('sends reset email with token and completes password reset flow, invalidating old sessions', async () => {
      // 1. Request forgot password for customer
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'customer@example.com' })
        .expect(201);

      expect(sentMails.length).toBeGreaterThan(0);
      const lastMail = sentMails[sentMails.length - 1];
      expect(lastMail.to).toBe('customer@example.com');
      expect(lastMail.resetLink).toContain('/reset-password?token=');

      const rawToken = new URL(lastMail.resetLink).searchParams.get('token')!;
      expect(rawToken).toBeDefined();

      // 2. Reject reset with invalid or expired token
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'fake-invalid-token', newPassword: 'NewPassword999' })
        .expect(400);

      // 3. Reset with valid token
      const resetRes = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPassword999' })
        .expect(201);

      expect(resetRes.body.message).toContain('Đặt lại mật khẩu thành công');

      // 4. Token cannot be reused
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'AnotherPassword123' })
        .expect(400);

      // 5. Old password no longer works
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'customer@example.com', password: 'Password123' })
        .expect(401);

      // 6. New password works
      const loginNew = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'customer@example.com', password: 'NewPassword999' })
        .expect(201);

      expect(loginNew.body.user.email).toBe('customer@example.com');
    });

    it('changes password when authenticated and invalidates previous sessionVersion', async () => {
      // Login to get valid cookie
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'customer@example.com', password: 'NewPassword999' })
        .expect(201);

      const cookie = login.headers['set-cookie'];

      // Attempt change with wrong old password
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ oldPassword: 'WrongOldPassword', newPassword: 'ChangedPassword888' })
        .expect(400);

      // Successful change
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ oldPassword: 'NewPassword999', newPassword: 'ChangedPassword888' })
        .expect(201);

      // Previous session is now invalid because sessionVersion incremented
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(401);

      // Login with newly changed password succeeds
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'customer@example.com', password: 'ChangedPassword888' })
        .expect(201);
    });
  });
});
