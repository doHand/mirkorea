import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { appConfig, jwtConfig, dbConfig } from './config/app.config'
import { AuthModule } from './modules/auth/auth.module'
import { ProductsModule } from './modules/products/products.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { StockModule } from './modules/stock/stock.module'
import { WarehouseModule } from './modules/warehouse/warehouse.module'
import { UsersModule } from './modules/users/users.module'
import { InboundModule } from './modules/inbound/inbound.module'
import { OutboundModule } from './modules/outbound/outbound.module'
import { ScanModule } from './modules/scan/scan.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, dbConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get('db.host'),
        port:     cfg.get<number>('db.port'),
        username: cfg.get('db.username'),
        password: cfg.get('db.password'),
        database: cfg.get('db.database'),
        entities:    [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations:  [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production',
        logging:     process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    StockModule,
    WarehouseModule,
    InboundModule,
    OutboundModule,
    ScanModule,
  ],
})
export class AppModule {}
