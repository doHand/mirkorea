import { IsString, IsOptional, IsNumber, IsPositive, IsDateString } from 'class-validator'

export class ScanInboundDto {
  @IsString()  barcode: string           // 상품 바코드
  @IsString()  locationBarcode: string   // 위치 바코드
  @IsOptional() @IsString()  orderId?: string
  @IsOptional() @IsNumber()  @IsPositive() qty?: number  // 박스 수량 (기본 1)
  @IsOptional() @IsString()  lotNumber?: string
  @IsOptional() @IsDateString() expiryDate?: string
}

export class ScanOutboundDto {
  @IsString()  barcode: string
  @IsString()  locationBarcode: string
  @IsOptional() @IsString()  orderId?: string
  @IsOptional() @IsNumber()  @IsPositive() qty?: number
  @IsOptional() @IsString()  lotNumber?: string
}

export class ScanAdjustDto {
  @IsString()  barcode: string
  @IsString()  locationBarcode: string
  @IsNumber()  newQty: number            // 새 수량 (절대값)
  @IsString()  reason: string
  @IsOptional() @IsString() lotNumber?: string
}

export class ScanMoveDto {
  @IsString() barcode: string
  @IsString() fromLocationBarcode: string
  @IsString() toLocationBarcode: string
  @IsNumber() @IsPositive() qty: number
  @IsOptional() @IsString() lotNumber?: string
}
