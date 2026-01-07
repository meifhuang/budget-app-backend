import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Try to get JWT from cookie first, then from Authorization header
    const token = request.cookies.token || 
                  request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized - No token' });
    }

    // Manually verify the token instead of using jwtVerify()
    const decoded = await request.server.jwt.verify(token);
    request.user = decoded;
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}
