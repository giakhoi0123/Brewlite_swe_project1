import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { jest } from '@jest/globals';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';

type TestUser = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  loyaltyPoints: number;
  role: Role;
  status: UserStatus;
};

let app: INestApplication;
let users: TestUser[];
let jwt: JwtService;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-long-enough-for-rbac-tests';
  users = [
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'staff@example.com',
      fullName: 'Staff',
      passwordHash: await bcrypt.hash('Password123', 10),
      loyaltyPoints: 0,
      role: Role.BARISTA,
      status: UserStatus.ACTIVE,
    },
  ];
  const prisma = {
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
          };
          users.push(user);
          return user;
        },
      ),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
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
        email: 'customer@example.com',
        password: 'Password123',
      })
      .expect(201);
    expect(response.body.user.role).toBe(Role.CUSTOMER);
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
        email: 'customer@example.com',
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
      expect(login.body.accessToken).toBeUndefined();
      expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', login.headers['set-cookie'])
        .expect(200);
      expect(me.body.user.role).toBe(role);
      const loggedOut = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', login.headers['set-cookie'])
        .expect(201);
      expect(loggedOut.headers['set-cookie'][0]).toContain(
        'Expires=Thu, 01 Jan 1970',
      );
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'WrongPassword123' })
      .expect(401);
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
    });
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', `Bearer ${forgedRole}`)
      .expect(403);
    const staffToken = await jwt.signAsync({ sub: users[0].id });
    await request(app.getHttpServer())
      .get('/api/barista/dashboard')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });
});
