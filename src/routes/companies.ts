import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const listSchema = z.object({ query: z.string().optional(), limit: z.coerce.number().optional() });

export async function companyRoutes(app: FastifyInstance) {
  // Search / list companies (for typeahead)
  app.get<{ Querystring: z.infer<typeof listSchema> }>(
    '/companies',
    async (request, reply) => {
      const { query, limit = 20 } = listSchema.parse(request.query);
      const where = query ? { name: { contains: query, mode: 'insensitive' as any } } : {};
      const takeCount = Math.min(100, Number(limit ?? 20));
      const companies = await prisma.company.findMany({
        where: where as any,
        take: takeCount,
        orderBy: { name: 'asc' },
      });
      return reply.send(companies);
    }
  );

  // Create company (idempotent)
  app.post<{ Body: { name: string } }>(
    '/companies',
    async (request, reply) => {
      const { name } = request.body;
      if (!name || !name.trim()) return reply.status(400).send({ error: 'name required' });

      // try find existing by unique name
      const existing = await prisma.company.findUnique({ where: { name } });
      if (existing) return reply.status(200).send(existing);

      const company = await prisma.company.create({ data: { name } });
      return reply.status(201).send(company);
    }
  );
}
