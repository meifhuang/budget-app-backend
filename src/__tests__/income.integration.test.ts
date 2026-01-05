import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import '../types/index'; // Add this if you have custom types

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        income: {
            create: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

import { incomeRoutes } from '../routes/income';
describe('Income Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(fastifyJWT, { secret: 'test-secret' });
    
    // Mock authenticate to skip JWT verification in tests
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { userId: 1, email: 'test@example.com' }; // Fake user
    });
    
    app.register(incomeRoutes);
    await app.ready(); 
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create income with valid data', async () => {
    const { prisma } = await import('../lib/prisma');
    
    // Mock successful creation
    (prisma.income.create as any).mockResolvedValue({
      id: 1,
      userId: 1,
      amount: 3000,
      source: 'freelance',
      date: new Date('2025-01-15'),
      createdAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/income',
      payload: { 
        amount: 3000, 
        source: 'freelance',
        date: new Date('2025-01-15')
      },
    });
    
    expect(response.statusCode).toBe(201);
    expect(response.json().source).toBe('freelance');

  });

  it('should return 400 for invalid amount', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/income',
      payload: { 
        amount: 'money', // Invalid
        source: 'freelance',
        date: '2025-01-15'
      },
    });

    expect(response.statusCode).toBe(400);
    // Check that error mentions amount validation
    const error = response.json();
    expect(error.message || error.error).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/income',
      payload: { 
        amount: 3000, 
        // missing source
        date: '2025-01-15'
      },
    });

    expect(response.statusCode).toBe(400);
  });


  it('should retrieve income transactions by year', async () => {
    const { prisma } = await import('../lib/prisma');
    
    (prisma.income.findMany as any).mockResolvedValue([
    { id: 1, userId: 1, amount: 3000, source: 'freelance', date: new Date('2025-01-15'), createdAt: new Date() },
    { id: 2, userId: 1, amount: 3000, source: 'freelance', date: new Date('2025-01-15'), createdAt: new Date() }
  ]);
    
    const response = await app.inject({
    method: 'GET',
    url: '/income?year=2025',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveLength(2);
  expect(response.json()[0].amount).toBe(3000);

  });

  it('should return 400 for invalid year parameter', async () => {
    const { prisma } = await import('../lib/prisma');
    
    (prisma.income.findMany as any).mockResolvedValue([
    { id: 1, userId: 1, amount: 3000, source: 'freelance', date: new Date('2025-01-15'), createdAt: new Date() },
  ]);
    
    const response = await app.inject({
    method: 'GET',
    url: '/income?year=-2',
  });

  expect(response.statusCode).toBe(400);
  });

  it('should return 400 for no year input', async () => {
    const { prisma } = await import('../lib/prisma');
    
    (prisma.income.findMany as any).mockResolvedValue([
    { id: 1, userId: 1, amount: 3000, source: 'freelance', date: new Date('2025-01-15'), createdAt: new Date() },
  ]);
    
    const response = await app.inject({
    method: 'GET',
    url: '/income',
  });

  expect(response.statusCode).toBe(400);
})

  it('should delete by id', async () => {
    const { prisma } = await import('../lib/prisma');
    
//      // Mock the record exists and belongs to userId 1
  (prisma.income.findUnique as any).mockResolvedValue({
    id: 1,
    userId: 1,
    amount: 3000,
    source: 'freelance',
    date: new Date('2025-01-15'),
    createdAt: new Date(),
  });

  // Mock delete to return the deleted record (Prisma returns the deleted object)
  (prisma.income.delete as any).mockResolvedValue({
    id: 1,
    userId: 1,
    amount: 3000,
    source: 'freelance',
    date: new Date('2025-01-15'),
    createdAt: new Date(),
  });

  const response = await app.inject({
    method: 'DELETE',
    url: '/income/1',
  });

  expect(response.statusCode).toBe(204);

  })
  it('should be unauthorized to delete this income', async () => {
    const { prisma } = await import('../lib/prisma');
    
// Mock the record exists and belongs to userId 1
  (prisma.income.findUnique as any).mockResolvedValue({
    id: 1,
    userId: 2,
    amount: 3000,
    source: 'freelance',
    date: new Date('2025-01-15'),
    createdAt: new Date(),
  });

  // Mock delete to return the deleted record (Prisma returns the deleted object)
  (prisma.income.delete as any).mockResolvedValue({
    id: 1,
    userId: 2,
    amount: 3000,
    source: 'freelance',
    date: new Date('2025-01-15'),
    createdAt: new Date(),
  });

  const response = await app.inject({
    method: 'DELETE',
    url: '/income/1',
  });

  expect(response.statusCode).toBe(403);

  })

  it('income not found', async () => {
    const { prisma } = await import('../lib/prisma');
    
  (prisma.income.findUnique as any).mockResolvedValue(null);

  const response = await app.inject({
    method: 'DELETE',
    url: '/income/999',
  });

  expect(response.statusCode).toBe(404);

  })

})
