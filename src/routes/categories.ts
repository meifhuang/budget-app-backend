import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const listSchema = z.object({ query: z.string().optional(), limit: z.coerce.number().optional() });

export async function categoryRoutes(app: FastifyInstance) {
  // list categories for current user (typeahead)
  app.get<{ Querystring: z.infer<typeof listSchema> }>(
    '/categories',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { query, limit = 50 } = listSchema.parse(request.query);
      const where: any = { userId };
      if (query) where.name = { contains: query as any, mode: 'insensitive' as any };
      const takeCount = Math.min(200, Number(limit ?? 50));
      const cats = await prisma.category.findMany({ where: where as any, take: takeCount, orderBy: { name: 'asc' } });
      return reply.send(cats);
    }
  );

  // create category for user
  app.post<{ Body: { name: string } }>(
    '/categories',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { name } = request.body;
      if (!name || !name.trim()) return reply.status(400).send({ error: 'name required' });

      const existing = await prisma.category.findFirst({ where: { userId, name } });
      if (existing) return reply.status(200).send(existing);

      const category = await prisma.category.create({ data: { userId, name } });
      return reply.status(201).send(category);
    }
  );
}
