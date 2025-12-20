import { z } from 'zod';

export const createIncomeSchema = z.object({
  amount: z.number('Must be a number').positive('Amount must be positive'),
  source: z.string().min(1, 'Source is required'),
  date: z.string().datetime('Invalid date format'),
});

