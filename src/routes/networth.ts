import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const createNetworthSchema = z.object({
  date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date' }),
  accounts: z
    .array(
      z.object({
        accountName: z.string().min(1, 'Account name required'),
        amount: z.number('Amount must be a number'),
      })
    )
    .min(1, 'At least one account is required'),
});

export async function networthRoutes(app: FastifyInstance) {
  // POST /networth - batch create snapshot
  app.post<{ Body: z.infer<typeof createNetworthSchema> }>(
    '/networth',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      try {
        const { date, accounts } = createNetworthSchema.parse(request.body);
        const snapshotDate = new Date(date);

        // createMany doesn't return created rows; use createMany then fetch created rows
        await prisma.netWorth.createMany({
          data: accounts.map((a) => ({
            userId,
            accountName: a.accountName,
            amount: a.amount,
            date: snapshotDate,
          })),
        });

        const created = await prisma.netWorth.findMany({
          where: { userId, date: snapshotDate },
          orderBy: { accountName: 'asc' },
        });

        return reply.status(201).send(created);
      } catch (error: any) {
        return reply.status(400).send({ error: error?.message || 'Failed to create networth snapshot' });
      }
    }
  );

  // GET /networth/current - most recent snapshot for user
  app.get('/networth/current', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).userId;
    try {
      const latest = await prisma.netWorth.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      });

      if (!latest) return reply.status(200).send({ total: 0, accounts: [] });

      const accounts = await prisma.netWorth.findMany({
        where: { userId, date: latest.date },
        orderBy: { accountName: 'asc' },
      });

      const total = accounts.reduce((s, a) => s + Number(a.amount), 0);

      return reply.status(200).send({ total, accounts });
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed to fetch current networth: ${error.message}` });
    }
  });

  // GET /networth?year=YYYY - monthly totals for year
  app.get<{ Querystring: { year?: string } }>(
    '/networth',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { year } = request.query;
      try {
        if (!year) return reply.status(400).send({ error: 'Year parameter required' });
        const y = parseInt(year, 10);
        if (!Number.isFinite(y) || y < 0) return reply.status(400).send({ error: 'Invalid year parameter' });

        const start = new Date(Date.UTC(y, 0, 1));
        const end = new Date(Date.UTC(y + 1, 0, 1));

        const entries = await prisma.netWorth.findMany({
          where: { userId, date: { gte: start, lt: end } },
        });

        // group by month (1-12)
        const monthly: Record<number, number> = {};
        for (const e of entries) {
          const dt = new Date(e.date);
          const month = dt.getUTCMonth() + 1;
          monthly[month] = (monthly[month] || 0) + Number(e.amount);
        }

        const result = Object.keys(monthly)
          .map((m) => ({ month: Number(m), total: monthly[Number(m)] }))
          .sort((a, b) => a.month - b.month);

        return reply.status(200).send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: `Failed to fetch networth by year: ${error.message}` });
      }
    }
  );
}