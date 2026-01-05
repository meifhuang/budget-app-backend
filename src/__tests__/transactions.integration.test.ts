import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import '../types/index';

// Mock Prisma (must be declared before importing routes)
vi.mock('../lib/prisma', () => ({
  prisma: {
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { transactionRoutes } from '../routes/transactions';

describe('Transactions Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(fastifyJWT, { secret: 'test-secret' });

    // Mock authenticate to skip real JWT verification
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { userId: 1, email: 'test@example.com' }; // fake user
    });

    app.register(transactionRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create transaction with valid data', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.create as any).mockResolvedValue({
      id: 1,
      userId: 1,
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      payload: {
        companyId: 2,
        categoryId: 3,
        item: 'Laptop',
        paymentType: 'card',
        amount: 1200,
        date: '2025-03-01',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().item).toBe('Laptop');
  });

  it('should return 400 for invalid payload (bad amount)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      payload: {
        companyId: 2,
        categoryId: 3,
        item: 'Laptop',
        paymentType: 'card',
        amount: 'twelve-hundred', // invalid
        date: '2025-03-01',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error || body.message).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/transactions',
      payload: {
        // missing companyId
        categoryId: 3,
        item: 'Laptop',
        paymentType: 'card',
        amount: 1200,
        date: '2025-03-01',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should list transactions filtered by year', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findMany as any).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        companyId: 2,
        categoryId: 3,
        item: 'Laptop',
        paymentType: 'card',
        amount: 1200,
        date: new Date('2025-03-01'),
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        companyId: 2,
        categoryId: 3,
        item: 'Mouse',
        paymentType: 'cash',
        amount: 30,
        date: new Date('2025-05-01'),
        createdAt: new Date(),
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/transactions?year=2025',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    expect(response.json()[0].amount).toBe(1200);
  });

  it('should return 400 for invalid year parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/transactions?year=-1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('should get single transaction by id', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 1,
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/transactions/1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(1);
  });

  it('should return 403 when fetching transaction owned by another user', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 2, // different user
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/transactions/1',
    });

    expect(response.statusCode).toBe(403);
  });

  it('should delete transaction by id (204)', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 1,
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    (prisma.transaction.delete as any).mockResolvedValue({
      id: 1,
      userId: 1,
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/transactions/1',
    });

    expect(response.statusCode).toBe(204);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should return 403 when deleting transaction owned by another user', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findUnique as any).mockResolvedValue({
      id: 1,
      userId: 2,
      companyId: 2,
      categoryId: 3,
      item: 'Laptop',
      paymentType: 'card',
      amount: 1200,
      date: new Date('2025-03-01'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/transactions/1',
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when deleting non-existent transaction', async () => {
    const { prisma } = await import('../lib/prisma');

    (prisma.transaction.findUnique as any).mockResolvedValue(null);

    const response = await app.inject({
      method: 'DELETE',
      url: '/transactions/999',
    });

    expect(response.statusCode).toBe(404);
  });
})