import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const createTransactionSchema = z.object({
  companyId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  item: z.string().min(1),
  paymentType: z.string().min(1),
  amount: z.number(),
  date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date' }),
})

export async function transactionRoutes(app: FastifyInstance) {
  // Create transaction
  app.post<{ Body: any }>(
  '/transactions',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const { company, category, item, paymentType, amount, date } = request.body;

      // Find or create company
      let companyRecord = await prisma.company.findUnique({ where: { name: company } });
      if (!companyRecord) {
        companyRecord = await prisma.company.create({ data: { name: company } });
      }

      // Find or create category (per user)
      let categoryRecord = await prisma.category.findFirst({
        where: { userId, name: category }
      });
      if (!categoryRecord) {
        categoryRecord = await prisma.category.create({
          data: { userId, name: category }
        });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          companyId: companyRecord.id,
          categoryId: categoryRecord.id,
          item,
          paymentType,
          amount: amount,
          date: new Date(date),
        },
      });

      return reply.status(201).send(transaction);
    } catch (error: any) {
      return reply.status(400).send({ error: `Failed: ${error.message}` });
    }
  }
);

app.put<{ Params: { id: string }; Body: any }>(
  '/transactions/:id',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const { id } = request.params;
      const { company, category, item, paymentType, amount, date } = request.body;

      // Verify ownership
      const existing = await prisma.transaction.findUnique({ where: { id: parseInt(id) } });
      if (!existing || existing.userId !== userId) {
        return reply.status(404).send({ error: 'Not found' });
      }

      // Find or create company & category
      let companyRecord = await prisma.company.findUnique({ where: { name: company } });
      if (!companyRecord) {
        companyRecord = await prisma.company.create({ data: { name: company } });
      }

      let categoryRecord = await prisma.category.findFirst({
        where: { userId, name: category }
      });
      if (!categoryRecord) {
        categoryRecord = await prisma.category.create({
          data: { userId, name: category }
        });
      }

      const updated = await prisma.transaction.update({
        where: { id: parseInt(id) },
        data: {
          companyId: companyRecord.id,
          categoryId: categoryRecord.id,
          item,
          paymentType,
          amount: amount,
          date: new Date(date),
        },
      });

      return reply.status(200).send(updated);
    } catch (error: any) {
      return reply.status(400).send({ error: `Failed: ${error.message}` });
    }
  }
);

  // List transactions with optional filters and ?year=YYYY
  app.get<{ Querystring: { year?: string; companyId?: string; categoryId?: string } }>(
    '/transactions',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const { year, companyId, categoryId } = request.query;

        const where: any = { userId };

        if (year !== undefined) {
          const y = parseInt(year, 10);
          if (!Number.isFinite(y) || y < 0) {
            return reply.status(400).send({ error: 'Invalid year parameter' });
          }
          const start = new Date(Date.UTC(y, 0, 1));
          const end = new Date(Date.UTC(y + 1, 0, 1));
          where.date = { gte: start, lt: end };
        }

        if (companyId !== undefined) {
          const cId = Number(companyId);
          if (Number.isNaN(cId)) return reply.status(400).send({ error: 'Invalid companyId' });
          where.companyId = cId;
        }

        if (categoryId !== undefined) {
          const catId = Number(categoryId);
          if (Number.isNaN(catId)) return reply.status(400).send({ error: 'Invalid categoryId' });
          where.categoryId = catId;
        }

        const transactions = await prisma.transaction.findMany({
          where,
          include: {
            company: { select: { name: true } },
            category: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        });

        return reply.status(200).send(transactions);
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to fetch transactions: ${error.message}` });
      }
    }
  );

  // Get single transaction by id
  app.get(
    '/transactions/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const id = Number((request.params as any).id);
        if (Number.isNaN(id)) return reply.status(400).send({ error: 'Invalid transaction id' });

        const transaction = await prisma.transaction.findUnique({ where: { id } });
        if (!transaction) return reply.status(404).send({ error: 'Transaction not found' });
        if (transaction.userId !== userId) return reply.status(403).send({ error: 'Not authorized' });

        return reply.status(200).send(transaction);
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to fetch transaction: ${error.message}` });
      }
    }
  );

  // Delete transaction by id
  app.delete<{ Params: { id: string } }>(
  '/transactions/:id',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params;

    try {
      const transaction = await prisma.transaction.findUnique({ where: { id: parseInt(id) } });
      if (!transaction || transaction.userId !== userId) {
        return reply.status(404).send({ error: 'Not found' });
      }

      await prisma.transaction.delete({ where: { id: parseInt(id) } });
      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed: ${error.message}` });
    }
  }
);
}