import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function authRoutes(app: FastifyInstance) {
  // Endpoint used by frontend: accepts either { id_token } or { token }
  app.post<{ Body: { id_token?: string; token?: string } }>('/auth/login', async (request, reply) => {
    const rawToken = request.body.id_token ?? request.body.token;

    if (!rawToken) {
      reply.status(400).send({ error: 'Missing id token' });
      return;
    }

    try {
      // Verify Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: rawToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        reply.status(401).send({ error: 'Invalid Google token payload' });
        return;
      }

      const { email, name, sub: googleId } = payload;

      // Upsert user by email — ensures single DB call
      const user = await prisma.user.upsert({
        where: { email },
        update: { name: name ?? undefined, googleId: googleId ?? undefined },
        create: { email: email ?? '', name: name ?? '', googleId: googleId ?? '' },
      });

      // Create application JWT
      const jwtToken = app.jwt.sign({ userId: user.id, email: user.email });

      // Set httpOnly cookie so frontend doesn't need to store token manually
      reply
        .setCookie('token', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        })
        .status(200)
        .send({ user });
    } catch (err: any) {
      app.log.error(err);
      reply.status(401).send({ error: 'Authentication failed' });
    }
  });

  // Logout endpoint: clears cookie
  app.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' }).status(200).send({ ok: true });
  });
}