import smartcar, {
  AuthClient,
  BatteryResponse,
  ChargeResponse,
  EngineResponse,
  LocationResponse,
  OdometerResponse,
  Vehicle,
  VehicleAttributes,
} from 'smartcar';

import { getSmartcarConfig, SmartcarConfig } from '../config/smartcarConfig';
import {
  SmartcarTokenRecord,
  getSmartcarTokenByUserId,
  listSmartcarTokens,
  upsertSmartcarToken,
} from '../db/repositories/smartcarToken.repository';
import { logger } from '../utils/logger';

const REFRESH_SKEW_MS = 60_000;

const serializeScopes = (scopes: string[]): string => scopes.join(' ');
const deserializeScopes = (scopes: string): string[] =>
  scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

const computeExpiry = (now: number, seconds: number): string =>
  new Date(now + seconds * 1000).toISOString();

export type SmartcarConnectResponse = {
  url: string;
  scope: string[];
};

export type SmartcarCallbackResult = {
  userId: string;
  scope: string[];
  expiresAt: string;
  refreshExpiresAt: string | null;
  vehicles: VehicleAttributes[];
  state?: string;
};

export type SmartcarVehicleSummary = VehicleAttributes;

export type SmartcarVehicleTelemetry = {
  vehicleId: string;
  batteryPercentage: number | null;
  isCharging: boolean;
  engineOn: boolean;
  odometerKm: number | null;
  location?: {
    latitude: number;
    longitude: number;
    recordedAt: string;
  } | null;
  fetchedAt: string;
};

const resolveTokenRecord = async (userId?: string): Promise<SmartcarTokenRecord> => {
  if (userId) {
    const token = await getSmartcarTokenByUserId(userId);
    if (!token) {
      throw new Error(`No Smartcar tokens stored for user ${userId}`);
    }
    return token;
  }

  const tokens = await listSmartcarTokens();
  if (tokens.length === 0) {
    throw new Error('No Smartcar connections available');
  }

  return tokens[0];
};

const fetchVehiclesWithAccessToken = async (
  accessToken: string,
): Promise<SmartcarVehicleSummary[]> => {
  const response = await smartcar.getVehicles(accessToken);
  const summaries = await Promise.all(
    response.vehicles.map(async (vehicleId) => {
      const vehicle = new Vehicle(vehicleId, accessToken);
      return vehicle.attributes();
    }),
  );

  return summaries;
};

export class SmartcarService {
  private readonly config: SmartcarConfig;

  private readonly authClient: AuthClient;

  constructor(config?: SmartcarConfig, authClient?: AuthClient) {
    this.config = config ?? getSmartcarConfig();
    this.authClient =
      authClient ??
      new smartcar.AuthClient({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUri: this.config.redirectUri,
        mode: this.config.mode,
        testMode: this.config.mode === 'test',
      });
  }

  getConnectUrl(state?: string): SmartcarConnectResponse {
    const url = this.authClient.getAuthUrl({
      scope: this.config.scopes,
      forcePrompt: this.config.forcePrompt,
      state,
    });

    return { url, scope: this.config.scopes };
  }

  async handleCallback(code: string, state?: string): Promise<SmartcarCallbackResult> {
    const token = await this.authClient.exchangeCode(code);
    const now = Date.now();

    const { accessToken, refreshToken, scope } = token;
    const scopeList = scope ?? [];
    const expiresAt = computeExpiry(now, token.expiresIn);
    const refreshExpiresAt = token.refreshTokenExpiresIn
      ? computeExpiry(now, token.refreshTokenExpiresIn)
      : null;

    const userId = await smartcar.getUserId(accessToken);
    await upsertSmartcarToken({
      userId,
      accessToken,
      refreshToken,
      scope: serializeScopes(scopeList),
      expiresAt,
      refreshExpiresAt,
    });

    const vehicles = await fetchVehiclesWithAccessToken(accessToken);

    logger.info({ userId, vehicleCount: vehicles.length }, 'smartcar callback processed');

    return { userId, scope: scopeList, expiresAt, refreshExpiresAt, vehicles, state };
  }

  async listVehicles(userId?: string): Promise<SmartcarVehicleSummary[]> {
    const token = await this.ensureValidToken(userId);
    return fetchVehiclesWithAccessToken(token.accessToken);
  }

  async getVehicleAttributes(
    vehicleId: string,
    userId?: string,
  ): Promise<SmartcarVehicleSummary> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.attributes();
  }

  async getVehicleBattery(vehicleId: string, userId?: string): Promise<BatteryResponse> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.battery();
  }

  async getVehicleCharge(vehicleId: string, userId?: string): Promise<ChargeResponse> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.charge();
  }

  async getVehicleLocation(
    vehicleId: string,
    userId?: string,
  ): Promise<LocationResponse> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.location();
  }

  async getVehicleOdometer(
    vehicleId: string,
    userId?: string,
  ): Promise<OdometerResponse> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.odometer();
  }

  async getVehicleEngine(vehicleId: string, userId?: string): Promise<EngineResponse> {
    const vehicle = await this.createVehicle(vehicleId, userId);
    return vehicle.engine();
  }

  async getVehicleTelemetry(
    vehicleId: string,
    userId?: string,
  ): Promise<SmartcarVehicleTelemetry> {
    const token = await this.ensureValidToken(userId);
    const vehicle = new smartcar.Vehicle(vehicleId, token.accessToken);

    const [battery, charge, odometer, engine, location] = await Promise.all([
      vehicle.battery().catch((error) => {
        logger.warn({ vehicleId, error }, 'smartcar battery request failed');
        return { percentRemaining: null } satisfies BatteryResponse;
      }),
      vehicle.charge().catch((error) => {
        logger.warn({ vehicleId, error }, 'smartcar charge request failed');
        return { isPluggedIn: false, state: 'UNKNOWN' } satisfies ChargeResponse;
      }),
      vehicle.odometer().catch((error) => {
        logger.warn({ vehicleId, error }, 'smartcar odometer request failed');
        return { distance: NaN } satisfies OdometerResponse;
      }),
      vehicle.engine().catch((error) => {
        logger.warn({ vehicleId, error }, 'smartcar engine request failed');
        return { isRunning: false } satisfies EngineResponse;
      }),
      vehicle.location().catch((error) => {
        logger.warn({ vehicleId, error }, 'smartcar location request failed');
        return null as LocationResponse | null;
      }),
    ]);

    const batteryPercentage =
      typeof battery.percentRemaining === 'number'
        ? Math.round(battery.percentRemaining * 100)
        : null;

    const odometerKm = Number.isFinite(odometer.distance) ? odometer.distance : null;

    return {
      vehicleId,
      batteryPercentage,
      isCharging: charge.state === 'CHARGING',
      engineOn: engine.isRunning,
      odometerKm,
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            recordedAt: location.time,
          }
        : null,
      fetchedAt: new Date().toISOString(),
    };
  }

  private async createVehicle(vehicleId: string, userId?: string): Promise<Vehicle> {
    const token = await this.ensureValidToken(userId);
    return new smartcar.Vehicle(vehicleId, token.accessToken);
  }

  private async ensureValidToken(userId?: string): Promise<SmartcarTokenRecord> {
    const token = await resolveTokenRecord(userId);
    const expiresAt = new Date(token.expiresAt).getTime();

    if (Number.isNaN(expiresAt)) {
      logger.warn(
        { userId: token.userId },
        'smartcar token missing expiry, attempting refresh',
      );
      return this.refreshToken(token);
    }

    if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
      return token;
    }

    return this.refreshToken(token);
  }

  private async refreshToken(token: SmartcarTokenRecord): Promise<SmartcarTokenRecord> {
    const refreshed = await this.authClient.exchangeRefreshToken(token.refreshToken);
    const now = Date.now();

    const scopeList =
      refreshed.scope && refreshed.scope.length > 0
        ? refreshed.scope
        : deserializeScopes(token.scope);
    const serializedScope = serializeScopes(scopeList);
    const expiresAt = computeExpiry(now, refreshed.expiresIn);
    const refreshExpiresAt = refreshed.refreshTokenExpiresIn
      ? computeExpiry(now, refreshed.refreshTokenExpiresIn)
      : null;

    await upsertSmartcarToken({
      userId: token.userId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      scope: serializedScope,
      expiresAt,
      refreshExpiresAt,
    });

    logger.info({ userId: token.userId }, 'smartcar token refreshed');

    return {
      ...token,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      scope: serializedScope,
      expiresAt,
      refreshExpiresAt,
      updatedAt: new Date().toISOString(),
    } satisfies SmartcarTokenRecord;
  }
}
