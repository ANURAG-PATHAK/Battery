/* eslint-disable max-classes-per-file */

declare module 'smartcar' {
  export type SmartcarScope = string;

  export interface AuthClientOptions {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    testMode?: boolean;
    mode?: 'test' | 'live';
  }

  export interface AuthUrlOptions {
    forcePrompt?: boolean;
    state?: string;
    scope?: SmartcarScope[];
  }

  export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshTokenExpiresIn: number;
    scope: SmartcarScope[];
  }

  export interface VehiclesResponse {
    paging?: {
      count: number;
      offset: number;
      total?: number;
    };
    vehicles: string[];
  }

  export interface VehicleAttributes {
    id: string;
    make: string;
    model: string;
    year: number;
  }

  export interface BatteryResponse {
    percentRemaining: number | null;
    rangeRemainingMeter?: number | null;
  }

  export interface ChargeResponse {
    isPluggedIn: boolean;
    state: string;
  }

  export interface LocationResponse {
    latitude: number;
    longitude: number;
    time: string;
  }

  export interface OdometerResponse {
    distance: number;
  }

  export interface EngineResponse {
    isRunning: boolean;
  }

  export class AuthClient {
    constructor(options: AuthClientOptions);
    getAuthUrl(options?: AuthUrlOptions): string;
    exchangeCode(code: string): Promise<TokenResponse>;
    exchangeRefreshToken(refreshToken: string): Promise<TokenResponse>;
  }

  export class Vehicle {
    constructor(id: string, token: string);
    attributes(): Promise<VehicleAttributes>;
    battery(): Promise<BatteryResponse>;
    charge(): Promise<ChargeResponse>;
    location(): Promise<LocationResponse>;
    odometer(): Promise<OdometerResponse>;
    engine(): Promise<EngineResponse>;
  }

  export function getVehicles(token: string): Promise<VehiclesResponse>;
  export function getUserId(token: string): Promise<string>;
}
