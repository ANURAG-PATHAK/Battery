import { Router } from 'express';

import { validateBody, type ValidatedRequest } from '../middleware/validation.middleware';
import {
  simulationRequestSchema,
  type SimulationRequestInput,
} from '../models/simulation';
import { getAvailableScenarios, simulateDrive } from '../services/simulation.service';
import { logger } from '../utils/logger';

export const simulationRouter = Router();

simulationRouter.get('/scenarios', (_req, res) => {
  res.json({ data: getAvailableScenarios() });
});

simulationRouter.post(
  '/drive',
  validateBody<SimulationRequestInput>(simulationRequestSchema),
  async (req, res, next) => {
    try {
      const { validatedBody } = req as ValidatedRequest<SimulationRequestInput>;
      const result = await simulateDrive({
        scenario: validatedBody.scenario,
        vehicleId: validatedBody.vehicleId,
        persist: validatedBody.persist ?? false,
        baseTimestamp: validatedBody.baseTimestamp,
      });

      logger.info(
        {
          vehicleId: result.vehicleId,
          scenario: result.scenario.name,
          persisted: result.persisted,
          score: result.after.score,
        },
        'simulation executed',
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
