type SmartcarMode = 'live' | 'test';

const parseScopes = (value: string | undefined): string[] => {
  if (!value) {
    return [
      'read_vehicle_info',
      'read_battery',
      'read_charge',
      'read_odometer',
      'read_location',
    ];
  }

  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

export const getSmartcarConfig = () => {
  const modeEnv = (process.env.SMARTCAR_MODE || 'test').toLowerCase();
  const mode: SmartcarMode = modeEnv === 'live' ? 'live' : 'test';

  const clientId = process.env.SMARTCAR_CLIENT_ID;
  const clientSecret = process.env.SMARTCAR_CLIENT_SECRET;
  const redirectUri = process.env.SMARTCAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Smartcar configuration is incomplete. Set SMARTCAR_CLIENT_ID, SMARTCAR_CLIENT_SECRET, and SMARTCAR_REDIRECT_URI.',
    );
  }

  const scopes = parseScopes(process.env.SMARTCAR_SCOPES);

  return {
    clientId,
    clientSecret,
    redirectUri,
    mode,
    scopes,
    forcePrompt: process.env.SMARTCAR_FORCE_PROMPT !== 'false',
  } as const;
};

export type SmartcarConfig = ReturnType<typeof getSmartcarConfig>;
