import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth';
import { incomeRoutes } from './routes/income';
import { authenticate } from './middleware/auth'
import './types/index';


const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.register(fastifyJWT, {
    secret: process.env.JWT_SECRET!,
})

fastify.decorate('authenticate', authenticate)

fastify.register(authRoutes)
fastify.register(incomeRoutes)


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