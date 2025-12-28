const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
};

export const getAppConfig = () => ({
  env: process.env.NODE_ENV || 'development',
  rateLimit: {
    windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parseInteger(process.env.RATE_LIMIT_MAX, 120),
  },
  requestIdHeader: (process.env.REQUEST_ID_HEADER || 'x-request-id').toLowerCase(),
  logging: {
    redactHeaders: ['authorization', 'cookie', 'x-api-key'],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
      },
    },
  },
});

export type AppConfig = ReturnType<typeof getAppConfig>;
