import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import '../types/index';

// Mock Prisma before importing routes
vi.mock('../lib/prisma', () => ({
  prisma: {
    netWorth: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { networthRoutes } from '../routes/networth';

describe('Networth Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(fastifyJWT, { secret: 'test-secret' });

    // mock authenticate to inject user
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { userId: 1, email: 'test@example.com' };
    });

    app.register(networthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should batch create networth snapshot', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.netWorth.createMany as any).mockResolvedValue({ count: 2 });
    (prisma.netWorth.findMany as any).mockResolvedValue([
      { id: 1, userId: 1, accountName: 'Cash', amount: 1000, date: new Date('2025-01-01'), createdAt: new Date() },
      { id: 2, userId: 1, accountName: 'Brokerage', amount: 5000, date: new Date('2025-01-01'), createdAt: new Date() },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/networth',
      payload: {
        date: '2025-01-01',
        accounts: [
          { accountName: 'Cash', amount: 1000 },
          { accountName: 'Brokerage', amount: 5000 },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveLength(2);
    expect(response.json()[0].accountName).toBe('Cash');
  });

  it('should return current snapshot with total', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.netWorth.findFirst as any).mockResolvedValue({ date: new Date('2025-06-01') });
    (prisma.netWorth.findMany as any).mockResolvedValue([
      { id: 10, userId: 1, accountName: 'A', amount: 200, date: new Date('2025-06-01') },
      { id: 11, userId: 1, accountName: 'B', amount: 300, date: new Date('2025-06-01') },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/networth/current',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(500);
    expect(response.json().accounts).toHaveLength(2);
  });

  it('should return monthly totals for a year', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.netWorth.findMany as any).mockResolvedValue([
      { id: 1, userId: 1, accountName: 'X', amount: 100, date: new Date('2025-01-10') },
      { id: 2, userId: 1, accountName: 'Y', amount: 200, date: new Date('2025-01-20') },
      { id: 3, userId: 1, accountName: 'Z', amount: 300, date: new Date('2025-02-05') },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/networth?year=2025',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // month 1 total 300, month 2 total 300
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ month: 1, total: 300 }),
        expect.objectContaining({ month: 2, total: 300 }),
      ])
    );
  });

  it('should return 400 for invalid date on create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/networth',
      payload: {
        date: 'not-a-date',
        accounts: [{ accountName: 'Cash', amount: 100 }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 for missing account fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/networth',
      payload: {
        date: '2025-01-01',
        accounts: [{ accountName: '', amount: 'x' }],
      },
    });
  })
})