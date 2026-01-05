import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import { categoryRoutes } from '../routes/categories';
import '../types/index';

vi.mock('../lib/prisma', () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Categories API', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(fastifyJWT, { secret: 'test-secret' });
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { userId: 1 };
    });

    app.register(categoryRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list categories for user', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.category.findMany as any).mockResolvedValue([{ id: 1, name: 'Food', userId: 1 }]);

    const res = await app.inject({ method: 'GET', url: '/categories?query=fo' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('should create category for user', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.category.findFirst as any).mockResolvedValue(null);
    (prisma.category.create as any).mockResolvedValue({ id: 2, name: 'Travel', userId: 1 });

    const res = await app.inject({ method: 'POST', url: '/categories', payload: { name: 'Travel' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Travel');
  });

  it('should return existing category when creating duplicate', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.category.findFirst as any).mockResolvedValue({ id: 3, name: 'Food', userId: 1 });

    const res = await app.inject({ method: 'POST', url: '/categories', payload: { name: 'Food' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(3);
  });
});
