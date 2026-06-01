import { registerAs } from '@nestjs/config'

export const appConfig  = registerAs('app',  () => ({ port: parseInt(process.env.PORT || '4000') }))
export const jwtConfig  = registerAs('jwt',  () => ({
  secret:         process.env.JWT_SECRET  || 'dev-secret',
  expiresIn:      process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret:  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}))
export const dbConfig   = registerAs('db',   () => ({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433'),
  username: process.env.DB_USER || 'wms_user',
  password: process.env.DB_PASSWORD || 'wms_pass',
  database: process.env.DB_NAME || 'wms_pro',
}))
