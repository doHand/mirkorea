import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, Min } from 'class-validator'

export type SaleStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'

export class CreateProductDto {
  @IsString() code: string
  @IsString() name: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() category?: string
  @IsOptional() @IsString() brand?: string
  @IsOptional() @IsString() unit?: string
  @IsOptional() @IsNumber() @Min(1) boxUnit?: number
  @IsOptional() @IsNumber() safetyStock?: number
  @IsOptional() @IsNumber() reorderPoint?: number
  @IsOptional() @IsNumber() reorderQty?: number
  @IsOptional() @IsNumber() costPrice?: number
  @IsOptional() @IsNumber() sellPrice?: number
  @IsOptional() @IsBoolean() isLotManaged?: boolean
  @IsOptional() @IsBoolean() isExpiryManaged?: boolean
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional() @IsEnum(['ACTIVE','INACTIVE','DISCONTINUED']) saleStatus?: SaleStatus
}

export class ProductFilterDto {
  page?:      number = 1
  limit?:     number = 50
  search?:    string
  category?:  string
  saleStatus?: SaleStatus
}
