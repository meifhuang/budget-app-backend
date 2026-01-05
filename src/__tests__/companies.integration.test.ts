import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { companyRoutes } from '../routes/companies';
import '../types/index';

vi.mock('../lib/prisma', () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Companies API', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(companyRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list companies', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.company.findMany as any).mockResolvedValue([{ id: 1, name: 'Acme' }]);

    const res = await app.inject({ method: 'GET', url: '/companies?query=ac' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('should create company', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.company.findUnique as any).mockResolvedValue(null);
    (prisma.company.create as any).mockResolvedValue({ id: 2, name: 'Globex' });

    const res = await app.inject({ method: 'POST', url: '/companies', payload: { name: 'Globex' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Globex');
  });

  it('should return existing company on create if exists', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.company.findUnique as any).mockResolvedValue({ id: 3, name: 'Acme' });

    const res = await app.inject({ method: 'POST', url: '/companies', payload: { name: 'Acme' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(3);
  });
});
