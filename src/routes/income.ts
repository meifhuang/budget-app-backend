import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { createIncomeSchema } from '../schemas/income';

export async function incomeRoutes(app: FastifyInstance) {
  // Create income
  app.post<{ Body: { amount: number; source: string; date: string } }>(
    '/income',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      try {
        const { amount, source, date } = createIncomeSchema.parse(request.body);
        const income = await prisma.income.create({
          data: {
            userId,
            amount,
            source,
            date: new Date(date),
          },
        });
        reply.status(201).send(income);
      } catch (error) {
        reply.status(400).send({ error: `Failed to create income: ${error.message}` });
      }
    }
  );

//Get income
  app.get<{ Querystring: {year: string } }> (
    '/income',
    { onRequest: [app.authenticate]},
    async (request, reply) => {
        const userId = (request.user as any).userId;
        const { year } = request.query;
     try {
        const where: any = { userId };

         if (!year) {
            return reply.status(400).send({ error: 'Year parameter required' });
        }

        if (year !== undefined) {
          const y = parseInt(year, 10);
          if (!Number.isFinite(y) || y < 0) {
            return reply.status(400).send({ error: 'Invalid year parameter' });
          }
          const start = new Date(Date.UTC(y, 0, 1));
          const end = new Date(Date.UTC(y + 1, 0, 1));
          where.date = { gte: start, lt: end };
        }

        const incomes = await prisma.income.findMany({
          where,
          orderBy: { date: 'desc' },
        });

        return reply.status(200).send(incomes);
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to fetch incomes: ${error.message}` });
      }
    }
  );

  //Delete income
  app.delete(
    '/income/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const id = Number((request.params as any).id);
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid income id' });
      }

      try {
        const income = await prisma.income.findUnique({ where: { id } });
        if (!income) return reply.status(404).send({ error: 'Income not found' });
        if (income.userId !== userId) return reply.status(403).send({ error: 'Not authorized to delete this income' });

        await prisma.income.delete({ where: { id } });
        return reply.status(204).send();
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to delete income: ${error.message}` });
      }
    }
  );




}
