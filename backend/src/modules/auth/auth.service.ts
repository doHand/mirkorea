import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { User } from '../users/entities/user.entity'
import { LoginDto, TokenResponseDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.userRepo.findOne({
      where: [{ username: dto.username }, { email: dto.username }],
    })
    if (!user || !user.isActive) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다')
    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다')

    await this.userRepo.update(user.id, { lastLoginAt: new Date() })
    return this.issueTokens(user)
  }

  private issueTokens(user: User): TokenResponseDto {
    const payload = { sub: user.id, username: user.username, role: user.role }
    return {
      accessToken:  this.jwt.sign(payload, { expiresIn: this.config.get('jwt.expiresIn') }),
      refreshToken: this.jwt.sign(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpires'),
      }),
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, warehouseId: user.warehouseId },
    }
  }

  async me(userId: string) {
    return this.userRepo.findOne({ where: { id: userId } })
  }
}
