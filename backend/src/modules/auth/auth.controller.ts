import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { User } from '../users/entities/user.entity'
import { ApiResponse } from '../../common/dto/api-response.dto'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return ApiResponse.ok(await this.authService.login(dto))
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: User) {
    return ApiResponse.ok(await this.authService.me(user.id))
  }
}
