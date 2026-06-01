import { IsUUID, IsInt, IsPositive, IsOptional, IsString, IsDateString } from 'class-validator'

export class CreateInboundDto {
  @IsUUID() productId: string
  @IsUUID() locationId: string
  @IsUUID() warehouseId: string
  @IsInt() @IsPositive() quantity: number

  @IsOptional() @IsString() barcodeUsed?: string
  @IsOptional() @IsString() lotNumber?: string
  @IsOptional() @IsDateString() expireDate?: string
  @IsOptional() @IsString() reason?: string
  @IsOptional() @IsString() memo?: string
  @IsOptional() @IsUUID() slipId?: string
}

export class CreateOutboundDto {
  @IsUUID() productId: string
  @IsUUID() locationId: string
  @IsUUID() warehouseId: string
  @IsInt() @IsPositive() quantity: number

  @IsOptional() @IsString() barcodeUsed?: string
  @IsOptional() @IsString() lotNumber?: string
  @IsOptional() @IsString() reason?: string
  @IsOptional() @IsString() memo?: string
  @IsOptional() @IsUUID() slipId?: string
}

export class CreateAdjustmentDto {
  @IsUUID() productId: string
  @IsUUID() locationId: string
  @IsUUID() warehouseId: string
  @IsInt() adjustedQty: number   // 조정 후 목표 수량 (절대값)

  @IsString() reason: string
  @IsOptional() @IsString() memo?: string
  @IsOptional() @IsString() lotNumber?: string
}

export class CreateMoveDto {
  @IsUUID() productId: string
  @IsUUID() fromLocationId: string
  @IsUUID() toLocationId: string
  @IsUUID() warehouseId: string
  @IsInt() @IsPositive() quantity: number

  @IsOptional() @IsString() reason?: string
  @IsOptional() @IsString() lotNumber?: string
}

export class CancelTxnDto {
  @IsString() reason: string
}

export class StockTxnQueryDto {
  @IsOptional() @IsUUID() productId?: string
  @IsOptional() @IsUUID() locationId?: string
  @IsOptional() @IsUUID() warehouseId?: string
  @IsOptional() @IsString() txType?: string
  @IsOptional() @IsString() from?: string
  @IsOptional() @IsString() to?: string
  @IsOptional() @IsUUID() performedBy?: string
  @IsOptional() page?: number
  @IsOptional() limit?: number
}
