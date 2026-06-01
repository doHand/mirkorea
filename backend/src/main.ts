import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] })

  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ResponseTransformInterceptor())

  const swagger = new DocumentBuilder()
    .setTitle('WMS Pro API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger))

  const config = app.get(ConfigService)
  const port = config.get<number>('app.port') || 4000
  await app.listen(port)
  console.log(`WMS Pro API running on http://localhost:${port}/api/v1`)
}
bootstrap()
