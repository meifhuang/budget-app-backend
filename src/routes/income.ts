import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

export const createIncomeSchema = z.object({
  amount: z.number('Must be a number').positive('Amount must be positive'),
  source: z.string().min(1, 'Source is required'),
  date: z.string('Invalid date format'),
});

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
        console.log(error)
        reply.status(400).send({ error: `Failed to create income: ${error.message}` });
      }
    }
  );

  app.get(
  '/income/years',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    const userId = (request.user as any).userId;

    try {
      const incomes = await prisma.income.findMany({
        where: { userId },
        select: { date: true },
        orderBy: { date: 'desc' },
      });

      const years = Array.from(
        new Set(incomes.map(inc => new Date(inc.date).getFullYear()))
      ).sort((a, b) => b - a);

      return reply.send({ years });
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed: ${error.message}` });
    }
  }
);

//Get income
  app.get<{ Querystring: {year?: string } }> (
    '/income',
    { onRequest: [app.authenticate]},
    async (request, reply) => {
        const userId = (request.user as any).userId;
        const { year } = request.query;
     try {
      // Get all incomes for user
      const allIncomes = await prisma.income.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });

      // Filter by year if provided
      let filteredIncomes = allIncomes;
      if (year) {
        const y = parseInt(year, 10);
        const start = new Date(Date.UTC(y, 0, 1));
        const end = new Date(Date.UTC(y + 1, 0, 1));
        filteredIncomes = allIncomes.filter(
          inc => new Date(inc.date) >= start && new Date(inc.date) < end
        );
      }

      return reply.send({
        yearIncomes: filteredIncomes,
        yearTotal: filteredIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0),
        allTimeTotal: allIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0),
      });
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed: ${error.message}` });
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
