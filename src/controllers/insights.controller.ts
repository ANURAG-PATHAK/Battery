import { Router } from 'express';

import { getVehicleInsights } from '../services/insights.service';
import { logger } from '../utils/logger';

export const insightsRouter = Router();

insightsRouter.get('/:vehicleId/insights', async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const insights = await getVehicleInsights(vehicleId);

    logger.info(
      {
        vehicleId: insights.vehicleId,
        score: insights.score,
        status: insights.status,
      },
      'vehicle insights retrieved',
    );

    res.json({ data: insights });
  } catch (error) {
    next(error);
  }
});
