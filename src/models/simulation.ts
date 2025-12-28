import { z } from 'zod';

export const simulationRequestSchema = z.object({
  scenario: z.enum(['urban', 'highway', 'mixed']),
  vehicleId: z.string().min(1).optional(),
  persist: z.boolean().optional(),
  baseTimestamp: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'baseTimestamp must be ISO-8601 when provided',
    }),
});

export type SimulationRequestInput = z.infer<typeof simulationRequestSchema>;
