import { Router } from 'express';

import { SmartcarService } from '../services/smartcar.service';
import { logger } from '../utils/logger';

let smartcarService: SmartcarService | null = null;

const getSmartcarService = (): SmartcarService => {
  if (!smartcarService) {
    smartcarService = new SmartcarService();
  }

  return smartcarService;
};

export const smartcarPublicRouter = Router();
export const smartcarRouter = Router();

smartcarPublicRouter.get('/connect', (req, res, next) => {
  try {
    const { state } = req.query as { state?: string };
    const connect = getSmartcarService().getConnectUrl(state);

    logger.info({ state }, 'smartcar connect url generated');

    res.json({ data: connect });
  } catch (error) {
    next(error);
  }
});

smartcarPublicRouter.get('/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code) {
      res.status(400).json({
        error: {
          code: 'SMARTCAR_CODE_MISSING',
          message: 'Missing Smartcar authorization code.',
        },
      });
      return;
    }

    const result = await getSmartcarService().handleCallback(code, state);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const vehicles = await getSmartcarService().listVehicles(userId);
    res.json({ data: { vehicles } });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles/:vehicleId/battery', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const { vehicleId } = req.params;
    const battery = await getSmartcarService().getVehicleBattery(vehicleId, userId);
    res.json({ data: { vehicleId, battery } });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles/:vehicleId/charge', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const { vehicleId } = req.params;
    const charge = await getSmartcarService().getVehicleCharge(vehicleId, userId);
    res.json({ data: { vehicleId, charge } });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles/:vehicleId/location', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const { vehicleId } = req.params;
    const location = await getSmartcarService().getVehicleLocation(vehicleId, userId);
    res.json({ data: { vehicleId, location } });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles/:vehicleId/odometer', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const { vehicleId } = req.params;
    const odometer = await getSmartcarService().getVehicleOdometer(vehicleId, userId);
    res.json({ data: { vehicleId, odometer } });
  } catch (error) {
    next(error);
  }
});

smartcarRouter.get('/vehicles/:vehicleId/engine', async (req, res, next) => {
  try {
    const { userId } = req.query as { userId?: string };
    const { vehicleId } = req.params;
    const engine = await getSmartcarService().getVehicleEngine(vehicleId, userId);
    res.json({ data: { vehicleId, engine } });
  } catch (error) {
    next(error);
  }
});
