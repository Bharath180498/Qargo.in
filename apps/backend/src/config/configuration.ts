export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  authMode: process.env.AUTH_MODE ?? 'mock',
  routeProvider: process.env.ROUTE_PROVIDER ?? 'mock',
  kycProvider: process.env.KYC_PROVIDER ?? 'mock',
  pushProvider: process.env.PUSH_PROVIDER ?? 'mock',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d'
  },
  otp: {
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    fixedCode: process.env.OTP_FIXED_CODE ?? '123456'
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  dispatchRadiusKm: Number(process.env.DISPATCH_RADIUS_KM ?? 8),
  waitingRatePerMinute: Number(process.env.WAITING_RATE_PER_MINUTE ?? 3),
  baseFarePerKm: Number(process.env.BASE_FARE_PER_KM ?? 14),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  idfyApiKey: process.env.IDFY_API_KEY ?? '',
  fcmServerKey: process.env.FCM_SERVER_KEY ?? '',
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? '',
    bucket: process.env.S3_BUCKET ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ''
  }
});
