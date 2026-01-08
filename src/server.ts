import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { authRoutes } from './routes/auth';
import { incomeRoutes } from './routes/income';
import { authenticate } from './middleware/auth';
import { transactionRoutes } from './routes/transactions';
import { companyRoutes } from './routes/companies';
import { categoryRoutes } from './routes/categories';
import './types/index';
import { networthRoutes } from './routes/networth';

const fastify = Fastify({
  logger: true,
});

// Register CORS first (allows credentials)
fastify.register(fastifyCors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

// Register cookie plugin before JWT (so setCookie/clearCookie work)
fastify.register(fastifyCookie);

// Register JWT
fastify.register(fastifyJWT, {
  secret: process.env.JWT_SECRET!,
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.decorate('authenticate', authenticate);

fastify.register(authRoutes);
fastify.register(incomeRoutes)
fastify.register(transactionRoutes)
fastify.register(companyRoutes)
fastify.register(categoryRoutes)
fastify.register(networthRoutes)


/**
 * Run the server!
 */
const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()