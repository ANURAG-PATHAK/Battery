import smartcar, {
  AuthClient,
  BatteryResponse,
  ChargeResponse,
  LocationResponse,
  OdometerResponse,
  TokenResponse,
  Vehicle,
  VehicleAttributes,
} from 'smartcar';

import { getSmartcarConfig, SmartcarConfig } from '../config/smartcarConfig';
import {
  SmartcarTokenRecord,
  getSmartcarTokenByUserId,
  listSmartcarTokens,
  deleteSmartcarToken,
  upsertSmartcarToken,
} from '../db/repositories/smartcarToken.repository';
import { logger } from '../utils/logger';
import { HttpError } from '../utils/errors';

const REFRESH_SKEW_MS = 60_000;
type SmartcarSdkError = {
  statusCode?: number;
  status?: number;
  message?: string;
  code?: string;
  requestId?: string;
  body?: unknown;
};

const normalizeSmartcarError = (
  error: unknown,
): SmartcarSdkError & { rawType: string } => {
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    return {
      statusCode:
        typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      requestId:
        typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
      body: candidate.body,
      rawType: candidate.constructor?.name ?? 'Object',
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
    rawType: error instanceof Error ? error.constructor.name : typeof error,
  };
};

const serializeScopes = (scopes: string[]): string => scopes.join(' ');
const deserializeScopes = (scopes: string): string[] =>
  scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

const permissionRevokedMessage =
  'Smartcar authorization no longer has required permissions. Restart Smartcar Connect to re-authorize access.';

const coerceScopeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((scope) => (typeof scope === 'string' ? scope.trim() : ''))
      .filter((scope) => scope.length > 0);
  }

  if (typeof value === 'string') {
    return deserializeScopes(value);
  }

  return [];
};

const extractTokenScopes = (token: unknown): string[] => {
  if (!token || typeof token !== 'object') {
    return [];
  }

  const candidate = token as Record<string, unknown>;
  // Smartcar SDK variants expose granted permissions under different keys; normalize them.
  const keys: Array<'scope' | 'scopes' | 'permissions'> = [
    'scope',
    'scopes',
    'permissions',
  ];

  const matched = keys
    .map((key) => coerceScopeArray(candidate[key]))
    .find((scopes) => scopes.length > 0);

  return matched ?? [];
};

const isPermissionRevokedError = (details: SmartcarSdkError): boolean => {
  if ((details.statusCode ?? details.status) !== 403) {
    return false;
  }

  const message = details.message?.toLowerCase() ?? '';
  return message.includes('insufficient permissions');
};

const handlePermissionRevocation = async (
  token: SmartcarTokenRecord,
  details: SmartcarSdkError,
  requiredScopes: Set<string>,
): Promise<never> => {
  try {
    await deleteSmartcarToken(token.userId);
    logger.warn(
      { userId: token.userId, requestId: details.requestId },
      'smartcar permission revoked; token removed',
    );
  } catch (cleanupError) {
    logger.error(
      { userId: token.userId, cleanupError },
      'failed to remove smartcar token after permission revocation',
    );
  }

  throw new HttpError(403, 'SMARTCAR_SCOPE_MISMATCH', permissionRevokedMessage, {
    requiredScopes: Array.from(requiredScopes),
    tokenScopes: deserializeScopes(token.scope),
    smartcarRequestId: details.requestId,
  });
};

const computeExpiry = (now: number, seconds: number | undefined | null): string => {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) {
    return new Date(now).toISOString();
  }

  const target = new Date(now + seconds * 1000);
  if (Number.isNaN(target.getTime())) {
    return new Date(now).toISOString();
  }

  return target.toISOString();
};

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

const tokenHasRequiredScopes = (
  requiredScopes: Set<string>,
  token: SmartcarTokenRecord,
): boolean => {
  const scopes = deserializeScopes(token.scope);
  return Array.from(requiredScopes).every((scope) => scopes.includes(scope));
};

const synchronizeTokenScopes = async (
  requiredScopes: Set<string>,
  token: SmartcarTokenRecord,
): Promise<SmartcarTokenRecord> => {
  const scopes = deserializeScopes(token.scope);
  if (scopes.length > 0) {
    return token;
  }

  const fallbackScopes = Array.from(requiredScopes);
  const serialized = serializeScopes(fallbackScopes);

  logger.warn(
    { userId: token.userId, fallbackScopes },
    'smartcar token missing stored scopes; normalizing to configured scopes',
  );

  await upsertSmartcarToken({
    userId: token.userId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    scope: serialized,
    expiresAt: token.expiresAt,
    refreshExpiresAt: token.refreshExpiresAt ?? null,
  });

  const refreshed = await getSmartcarTokenByUserId(token.userId);
  return (
    refreshed ?? {
      ...token,
      scope: serialized,
      updatedAt: new Date().toISOString(),
    }
  );
};

const handleTelemetryRequestFailure = async <T>(options: {
  error: unknown;
  fallback: T;
  vehicleId: string;
  userId: string;
  segment: string;
  token: SmartcarTokenRecord;
  requiredScopes: Set<string>;
}): Promise<T> => {
  const { error, fallback, vehicleId, userId, segment, token, requiredScopes } = options;
  const details = normalizeSmartcarError(error);
  const tokenScopes = deserializeScopes(token.scope);
  const tokenSatisfiesScopes = tokenHasRequiredScopes(requiredScopes, token);
  logger.warn(
    { vehicleId, userId, segment, err: details, tokenScopes },
    'smartcar telemetry request failed',
  );

  if (isPermissionRevokedError(details) && !tokenSatisfiesScopes) {
    await handlePermissionRevocation(token, details, requiredScopes);
  }

  if (isPermissionRevokedError(details) && tokenSatisfiesScopes) {
    logger.warn(
      {
        vehicleId,
        userId,
        segment,
        requiredScopes: Array.from(requiredScopes),
        tokenScopes,
        requestId: details.requestId,
      },
      'smartcar permission denied even though scopes match; keeping token and returning fallback',
    );
    return fallback;
  }

  return fallback;
};

const resolveTokenRecord = async (
  requiredScopes: Set<string>,
  userId?: string,
): Promise<SmartcarTokenRecord> => {
  if (userId) {
    const token = await getSmartcarTokenByUserId(userId);
    if (!token) {
      throw new HttpError(
        404,
        'SMARTCAR_TOKEN_NOT_FOUND',
        `No Smartcar connection stored for Smartcar user ${userId}. Re-run the Smartcar Connect flow to authorize access.`,
      );
    }
    const normalizedToken = await synchronizeTokenScopes(requiredScopes, token);
    if (!tokenHasRequiredScopes(requiredScopes, normalizedToken)) {
      throw new HttpError(
        403,
        'SMARTCAR_SCOPE_MISMATCH',
        'The stored Smartcar authorization is missing required permissions. Remove the connection and run Smartcar Connect again to refresh scopes.',
        {
          requiredScopes: Array.from(requiredScopes),
          tokenScopes: deserializeScopes(normalizedToken.scope),
        },
      );
    }
    return normalizedToken;
  }

  const tokens = await listSmartcarTokens();
  if (tokens.length === 0) {
    throw new HttpError(
      404,
      'SMARTCAR_TOKEN_MISSING',
      'No Smartcar connections available. Complete the Smartcar Connect flow before calling this endpoint.',
    );
  }

  const searchResult = await tokens.reduce<
    Promise<{ match: SmartcarTokenRecord | null; scopes: string[] }>
  >(
    async (accumulatorPromise, token) => {
      const accumulator = await accumulatorPromise;
      if (accumulator.match) {
        return accumulator;
      }

      const normalizedToken = await synchronizeTokenScopes(requiredScopes, token);
      const scopes = deserializeScopes(normalizedToken.scope);

      if (tokenHasRequiredScopes(requiredScopes, normalizedToken)) {
        return { match: normalizedToken, scopes };
      }

      return { match: null, scopes };
    },
    Promise.resolve({ match: null, scopes: [] }),
  );

  if (searchResult.match) {
    return searchResult.match;
  }

  throw new HttpError(
    403,
    'SMARTCAR_SCOPE_MISMATCH',
    'The stored Smartcar authorization is missing required permissions. Remove the connection and run Smartcar Connect again to refresh scopes.',
    {
      requiredScopes: Array.from(requiredScopes),
      tokenScopes: searchResult.scopes,
    },
  );
};

const fetchVehiclesWithAccessToken = async (
  accessToken: string,
): Promise<SmartcarVehicleSummary[]> => {
  const response = await smartcar.getVehicles(accessToken);
  const summaries = await Promise.all(
    response.vehicles.map(async (vehicleId: string) => {
      const vehicle = new Vehicle(vehicleId, accessToken);
      return vehicle.attributes();
    }),
  );

  return summaries;
};

export class SmartcarService {
  private readonly config: SmartcarConfig;

  private readonly authClient: AuthClient;

  private readonly requiredScopes: Set<string>;

  constructor(config?: SmartcarConfig, authClient?: AuthClient) {
    this.config = config ?? getSmartcarConfig();
    this.authClient =
      authClient ??
      new smartcar.AuthClient({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUri: this.config.redirectUri,
        mode: this.config.mode,
      });
    this.requiredScopes = new Set(this.config.scopes);
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
    let token: TokenResponse;
    try {
      token = await this.authClient.exchangeCode(code);
    } catch (error) {
      const details = normalizeSmartcarError(error);
      logger.error({ err: details }, 'smartcar exchange code failed');
      const status = details.statusCode ?? details.status ?? 502;
      const clientMessage =
        status >= 400 && status < 500
          ? 'Smartcar authorization failed. Restart the Connect flow.'
          : 'Smartcar authorization service unavailable.';
      throw new HttpError(status, 'SMARTCAR_OAUTH_ERROR', clientMessage, details);
    }

    const now = Date.now();

    const { accessToken, refreshToken } = token;
    const tokenScopes = extractTokenScopes(token);
    const usedScopeFallback = tokenScopes.length === 0;
    const scopeList = tokenScopes.length > 0 ? tokenScopes : [...this.config.scopes];
    const expiresAt = computeExpiry(now, token.expiresIn);
    const refreshExpiresAt = token.refreshTokenExpiresIn
      ? computeExpiry(now, token.refreshTokenExpiresIn)
      : null;
    logger.debug(
      {
        state,
        scopeCount: scopeList.length,
        expiresAt,
        hasRefresh: Boolean(refreshExpiresAt),
      },
      'smartcar exchange succeeded',
    );

    let userId: string;
    try {
      const user = await smartcar.getUser(accessToken);
      userId = user.id;
      if (user.meta?.requestId) {
        logger.debug(
          { userId, requestId: user.meta.requestId },
          'smartcar user meta received',
        );
      }

      if (usedScopeFallback) {
        logger.warn(
          { userId, requestedScopes: this.config.scopes },
          'smartcar token response missing scopes; falling back to configured scopes',
        );
      }
    } catch (error) {
      const details = normalizeSmartcarError(error);
      logger.error({ err: details }, 'smartcar user lookup failed');
      throw new HttpError(
        502,
        'SMARTCAR_USER_LOOKUP_FAILED',
        'Unable to resolve Smartcar user information.',
        details,
      );
    }

    logger.debug({ userId }, 'smartcar user resolved');

    try {
      await upsertSmartcarToken({
        userId,
        accessToken,
        refreshToken,
        scope: serializeScopes(scopeList),
        expiresAt,
        refreshExpiresAt,
      });
    } catch (error) {
      const details = normalizeSmartcarError(error);
      logger.error({ err: details }, 'smartcar token storage failed');
      throw new HttpError(
        500,
        'SMARTCAR_TOKEN_PERSIST_FAILED',
        'Unable to store Smartcar credentials.',
        details,
      );
    }

    logger.debug({ userId }, 'smartcar token stored');

    let vehicles: SmartcarVehicleSummary[];
    try {
      vehicles = await fetchVehiclesWithAccessToken(accessToken);
    } catch (error) {
      const details = normalizeSmartcarError(error);
      logger.error({ err: details }, 'smartcar vehicle fetch failed');
      throw new HttpError(
        502,
        'SMARTCAR_VEHICLE_FETCH_FAILED',
        'Unable to fetch vehicles from Smartcar.',
        details,
      );
    }

    logger.info({ userId, vehicleCount: vehicles.length }, 'smartcar callback processed');

    return { userId, scope: scopeList, expiresAt, refreshExpiresAt, vehicles, state };
  }

  async listVehicles(userId?: string): Promise<SmartcarVehicleSummary[]> {
    const token = await this.ensureValidToken(userId);
    return fetchVehiclesWithAccessToken(token.accessToken);
  }

  async getVehicleBattery(vehicleId: string, userId?: string): Promise<BatteryResponse> {
    const { vehicle, token } = await this.createVehicle(vehicleId, userId);
    try {
      const battery = await vehicle.battery();
      logger.info({ vehicleId, userId: token.userId }, 'smartcar battery fetched');
      return battery;
    } catch (error) {
      const details = normalizeSmartcarError(error);
      const tokenScopes = deserializeScopes(token.scope);
      const tokenSatisfiesScopes = tokenHasRequiredScopes(this.requiredScopes, token);
      logger.error(
        { vehicleId, userId: token.userId, err: details, tokenScopes },
        'smartcar battery fetch failed',
      );
      if (isPermissionRevokedError(details) && !tokenSatisfiesScopes) {
        await handlePermissionRevocation(token, details, this.requiredScopes);
      }
      if (isPermissionRevokedError(details) && tokenSatisfiesScopes) {
        logger.warn(
          {
            vehicleId,
            userId: token.userId,
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: details.requestId,
          },
          'smartcar permission denied but scopes match; attempting refresh and retry',
        );

        const retry = await this.retryWithRefreshedToken({
          vehicleId,
          token,
          segment: 'battery',
          fetch: (retryVehicle) => retryVehicle.battery(),
        });

        if (retry.ok) {
          return retry.value;
        }

        throw new HttpError(
          retry.details.statusCode ?? retry.details.status ?? 403,
          'SMARTCAR_PERMISSION_DENIED',
          'Smartcar denied access to battery data. Ask the driver to re-run Smartcar Connect.',
          {
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: retry.details.requestId ?? details.requestId,
            rawType: retry.details.rawType,
            message: retry.details.message,
          },
        );
      }
      const status = details.statusCode ?? details.status ?? 502;
      throw new HttpError(
        status,
        'SMARTCAR_BATTERY_FETCH_FAILED',
        'Unable to fetch Smartcar battery data.',
        details,
      );
    }
  }

  async getVehicleCharge(vehicleId: string, userId?: string): Promise<ChargeResponse> {
    const { vehicle, token } = await this.createVehicle(vehicleId, userId);
    try {
      const charge = await vehicle.charge();
      logger.info({ vehicleId, userId: token.userId }, 'smartcar charge fetched');
      return charge;
    } catch (error) {
      const details = normalizeSmartcarError(error);
      const tokenScopes = deserializeScopes(token.scope);
      const tokenSatisfiesScopes = tokenHasRequiredScopes(this.requiredScopes, token);
      logger.error(
        { vehicleId, userId: token.userId, err: details, tokenScopes },
        'smartcar charge fetch failed',
      );
      if (isPermissionRevokedError(details) && !tokenSatisfiesScopes) {
        await handlePermissionRevocation(token, details, this.requiredScopes);
      }
      if (isPermissionRevokedError(details) && tokenSatisfiesScopes) {
        logger.warn(
          {
            vehicleId,
            userId: token.userId,
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: details.requestId,
          },
          'smartcar permission denied but scopes match; attempting refresh and retry',
        );

        const retry = await this.retryWithRefreshedToken({
          vehicleId,
          token,
          segment: 'charge',
          fetch: (retryVehicle) => retryVehicle.charge(),
        });

        if (retry.ok) {
          return retry.value;
        }

        throw new HttpError(
          retry.details.statusCode ?? retry.details.status ?? 403,
          'SMARTCAR_PERMISSION_DENIED',
          'Smartcar denied access to charge data. Ask the driver to re-run Smartcar Connect.',
          {
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: retry.details.requestId ?? details.requestId,
            rawType: retry.details.rawType,
            message: retry.details.message,
          },
        );
      }
      const status = details.statusCode ?? details.status ?? 502;
      throw new HttpError(
        status,
        'SMARTCAR_CHARGE_FETCH_FAILED',
        'Unable to fetch Smartcar charge data.',
        details,
      );
    }
  }

  async getVehicleLocation(
    vehicleId: string,
    userId?: string,
  ): Promise<LocationResponse> {
    const { vehicle, token } = await this.createVehicle(vehicleId, userId);
    try {
      const location = await vehicle.location();
      logger.info({ vehicleId, userId: token.userId }, 'smartcar location fetched');
      return location;
    } catch (error) {
      const details = normalizeSmartcarError(error);
      const tokenScopes = deserializeScopes(token.scope);
      const tokenSatisfiesScopes = tokenHasRequiredScopes(this.requiredScopes, token);
      logger.error(
        { vehicleId, userId: token.userId, err: details, tokenScopes },
        'smartcar location fetch failed',
      );
      if (isPermissionRevokedError(details) && !tokenSatisfiesScopes) {
        await handlePermissionRevocation(token, details, this.requiredScopes);
      }
      if (isPermissionRevokedError(details) && tokenSatisfiesScopes) {
        logger.warn(
          {
            vehicleId,
            userId: token.userId,
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: details.requestId,
          },
          'smartcar permission denied but scopes match; attempting refresh and retry',
        );

        const retry = await this.retryWithRefreshedToken({
          vehicleId,
          token,
          segment: 'location',
          fetch: (retryVehicle) => retryVehicle.location(),
        });

        if (retry.ok) {
          return retry.value;
        }

        throw new HttpError(
          retry.details.statusCode ?? retry.details.status ?? 403,
          'SMARTCAR_PERMISSION_DENIED',
          'Smartcar denied access to location data. Ask the driver to re-run Smartcar Connect.',
          {
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: retry.details.requestId ?? details.requestId,
            rawType: retry.details.rawType,
            message: retry.details.message,
          },
        );
      }
      const status = details.statusCode ?? details.status ?? 502;
      throw new HttpError(
        status,
        'SMARTCAR_LOCATION_FETCH_FAILED',
        'Unable to fetch Smartcar location data.',
        details,
      );
    }
  }

  async getVehicleOdometer(
    vehicleId: string,
    userId?: string,
  ): Promise<OdometerResponse> {
    const { vehicle, token } = await this.createVehicle(vehicleId, userId);
    try {
      const odometer = await vehicle.odometer();
      logger.info({ vehicleId, userId: token.userId }, 'smartcar odometer fetched');
      return odometer;
    } catch (error) {
      const details = normalizeSmartcarError(error);
      const tokenScopes = deserializeScopes(token.scope);
      const tokenSatisfiesScopes = tokenHasRequiredScopes(this.requiredScopes, token);
      logger.error(
        { vehicleId, userId: token.userId, err: details, tokenScopes },
        'smartcar odometer fetch failed',
      );
      if (isPermissionRevokedError(details) && !tokenSatisfiesScopes) {
        await handlePermissionRevocation(token, details, this.requiredScopes);
      }
      if (isPermissionRevokedError(details) && tokenSatisfiesScopes) {
        logger.warn(
          {
            vehicleId,
            userId: token.userId,
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: details.requestId,
          },
          'smartcar permission denied but scopes match; attempting refresh and retry',
        );

        const retry = await this.retryWithRefreshedToken({
          vehicleId,
          token,
          segment: 'odometer',
          fetch: (retryVehicle) => retryVehicle.odometer(),
        });

        if (retry.ok) {
          return retry.value;
        }

        throw new HttpError(
          retry.details.statusCode ?? retry.details.status ?? 403,
          'SMARTCAR_PERMISSION_DENIED',
          'Smartcar denied access to odometer data. Ask the driver to re-run Smartcar Connect.',
          {
            requiredScopes: Array.from(this.requiredScopes),
            tokenScopes,
            requestId: retry.details.requestId ?? details.requestId,
            rawType: retry.details.rawType,
            message: retry.details.message,
          },
        );
      }
      const status = details.statusCode ?? details.status ?? 502;
      throw new HttpError(
        status,
        'SMARTCAR_ODOMETER_FETCH_FAILED',
        'Unable to fetch Smartcar odometer data.',
        details,
      );
    }
  }

  async getVehicleEngine(vehicleId: string, userId?: string): Promise<never> {
    const token = await this.ensureValidToken(userId);
    logger.warn(
      { vehicleId, userId, scope: token.scope },
      'engine state not supported by Smartcar SDK',
    );
    throw new HttpError(
      501,
      'SMARTCAR_ENGINE_UNSUPPORTED',
      'Smartcar does not expose engine state for this integration.',
    );
  }

  async getVehicleTelemetry(
    vehicleId: string,
    userId?: string,
  ): Promise<SmartcarVehicleTelemetry> {
    const token = await this.ensureValidToken(userId);
    const vehicle = new smartcar.Vehicle(vehicleId, token.accessToken);
    const telemetryScopes = this.requiredScopes;
    const tokenUserId = token.userId;

    const [battery, charge, odometer, location] = await Promise.all([
      vehicle.battery().catch((error: unknown) =>
        handleTelemetryRequestFailure({
          error,
          fallback: { percentRemaining: null } satisfies BatteryResponse,
          vehicleId,
          userId: tokenUserId,
          segment: 'battery',
          token,
          requiredScopes: telemetryScopes,
        }),
      ),
      vehicle.charge().catch((error: unknown) =>
        handleTelemetryRequestFailure({
          error,
          fallback: { isPluggedIn: false, state: 'UNKNOWN' } satisfies ChargeResponse,
          vehicleId,
          userId: tokenUserId,
          segment: 'charge',
          token,
          requiredScopes: telemetryScopes,
        }),
      ),
      vehicle.odometer().catch((error: unknown) =>
        handleTelemetryRequestFailure({
          error,
          fallback: { distance: NaN } satisfies OdometerResponse,
          vehicleId,
          userId: tokenUserId,
          segment: 'odometer',
          token,
          requiredScopes: telemetryScopes,
        }),
      ),
      vehicle.location().catch((error: unknown) =>
        handleTelemetryRequestFailure({
          error,
          fallback: null as LocationResponse | null,
          vehicleId,
          userId: tokenUserId,
          segment: 'location',
          token,
          requiredScopes: telemetryScopes,
        }),
      ),
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
      engineOn: false,
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

  private async retryWithRefreshedToken<T>(params: {
    vehicleId: string;
    token: SmartcarTokenRecord;
    segment: string;
    fetch: (vehicle: Vehicle) => Promise<T>;
  }): Promise<
    | { ok: true; value: T }
    | { ok: false; details: SmartcarSdkError & { rawType: string } }
  > {
    const refreshedToken = await this.refreshToken(params.token);
    const retryVehicle = new smartcar.Vehicle(
      params.vehicleId,
      refreshedToken.accessToken,
    );

    try {
      const value = await params.fetch(retryVehicle);
      logger.info(
        {
          vehicleId: params.vehicleId,
          userId: refreshedToken.userId,
          segment: params.segment,
        },
        'smartcar fetch succeeded after refresh',
      );
      return { ok: true, value };
    } catch (error) {
      const details = normalizeSmartcarError(error);
      logger.error(
        {
          vehicleId: params.vehicleId,
          userId: refreshedToken.userId,
          segment: params.segment,
          err: details,
          retry: true,
        },
        'smartcar fetch retry failed',
      );
      return { ok: false, details };
    }
  }

  private async createVehicle(
    vehicleId: string,
    userId?: string,
  ): Promise<{ vehicle: Vehicle; token: SmartcarTokenRecord }> {
    const token = await this.ensureValidToken(userId);
    logger.debug({ vehicleId, userId: token.userId }, 'smartcar token resolved');
    const vehicle = new smartcar.Vehicle(vehicleId, token.accessToken);
    return { vehicle, token };
  }

  private async ensureValidToken(userId?: string): Promise<SmartcarTokenRecord> {
    const token = await resolveTokenRecord(this.requiredScopes, userId);
    const expiresAt = new Date(token.expiresAt).getTime();

    if (Number.isNaN(expiresAt)) {
      logger.warn(
        { userId: token.userId },
        'smartcar token missing expiry, attempting refresh',
      );
      return this.refreshToken(token);
    }

    if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
      logger.debug({ userId: token.userId, expiresAt }, 'smartcar token still valid');
      return token;
    }

    logger.debug({ userId: token.userId, expiresAt }, 'smartcar token refreshing');
    return this.refreshToken(token);
  }

  private async refreshToken(token: SmartcarTokenRecord): Promise<SmartcarTokenRecord> {
    const refreshed = await this.authClient.exchangeRefreshToken(token.refreshToken);
    const now = Date.now();

    const refreshedScopes = extractTokenScopes(refreshed);
    const existingScopes = deserializeScopes(token.scope);
    const scopeSource = [refreshedScopes, existingScopes, this.config.scopes].find(
      (scopes) => scopes.length > 0,
    );
    let scopeList: string[] = [];
    if (scopeSource) {
      scopeList = scopeSource === this.config.scopes ? [...scopeSource] : scopeSource;
    }
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
