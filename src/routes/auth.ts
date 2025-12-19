import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { token: string } }>('/auth/login', async (request, reply) => {
    const { token } = request.body;

    try {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new Error('Invalid token');

      const { email, name, sub: googleId } = payload;

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email: email || '', name: name || '', googleId: googleId || '' },
        });
      }

      // Create JWT
      const jwtToken = app.jwt.sign({ userId: user.id, email: user.email });

      return { token: jwtToken, user };
    } catch (error) {
        console.error('Auth error:', error.message);
      reply.status(401).send({ error: 'Authentication failed' });
    }
  });
}