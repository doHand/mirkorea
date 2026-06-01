import { IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsString() username: string
  @IsString() @MinLength(4) password: string
}

export class TokenResponseDto {
  accessToken: string
  refreshToken: string
  user: { id: string; username: string; fullName: string; role: string; warehouseId: string }
}
