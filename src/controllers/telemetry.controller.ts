import { Router } from 'express';

import { validateBody, type ValidatedRequest } from '../middleware/validation.middleware';
import { telemetryPayloadSchema, type NormalizedTelemetry } from '../models/telemetry';
import { recordTelemetry } from '../services/telemetryRecorder.service';
import { logger } from '../utils/logger';

export const telemetryRouter = Router();

telemetryRouter.post(
  '/',
  validateBody<NormalizedTelemetry>(telemetryPayloadSchema),
  async (req, res, next) => {
    try {
      const { validatedBody } = req as ValidatedRequest<NormalizedTelemetry>;
      const result = await recordTelemetry({ telemetry: validatedBody });

      logger.info(
        {
          vehicleId: result.vehicleId,
          score: result.score,
          status: result.status,
          rulesTriggered: result.evaluation.ruleImpacts.map((impact) => impact.id),
        },
        'telemetry ingested',
      );

      res.status(201).json({
        data: {
          vehicleId: result.vehicleId,
          score: result.score,
          status: result.status,
          baseScore: result.evaluation.baseScore,
          alerts: result.alerts,
          tips: result.tips,
          ruleImpacts: result.evaluation.ruleImpacts,
          telemetry: validatedBody,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
