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
  app.post<{ Body: z.infer<typeof createTransactionSchema> }>(
    '/transactions',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const { companyId, categoryId, item, paymentType, amount, date } =
          createTransactionSchema.parse(request.body);
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return reply.status(400).send({ error: 'Company not found' });

        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) return reply.status(400).send({ error: 'Category not found' });
        if (category.userId !== userId) return reply.status(403).send({ error: 'Not authorized to use this category' });

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            companyId,
            categoryId,
            item,
            paymentType,
            amount,
            date: new Date(date),
          },
        });

        return reply.status(201).send(transaction);
      } catch (error: any) {
        return reply.status(400).send({ error: `Failed to create transaction: ${error.message}` });
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
  app.delete(
    '/transactions/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const id = Number((request.params as any).id);
        if (Number.isNaN(id)) return reply.status(400).send({ error: 'Invalid transaction id' });

        const transaction = await prisma.transaction.findUnique({ where: { id } });
        if (!transaction) return reply.status(404).send({ error: 'Transaction not found' });
        if (transaction.userId !== userId) return reply.status(403).send({ error: 'Not authorized to delete this transaction' });

        await prisma.transaction.delete({ where: { id } });
        return reply.status(204).send();
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to delete transaction: ${error.message}` });
      }
    }
  );
}