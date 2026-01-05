import { describe, it, expect, beforeAll, afterAll, beforeEach, vi} from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from '../routes/auth';
import { OAuth2Client } from 'google-auth-library';


describe('Auth Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    app.register(authRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

it('should return 401 with invalid token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { token: 'invalid_token' },
    });

    expect(response.statusCode).toBe(401);
  });
});
