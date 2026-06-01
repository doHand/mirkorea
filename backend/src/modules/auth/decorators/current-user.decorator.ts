import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { SetMetadata } from '@nestjs/common'
import { ROLES_KEY } from '../guards/roles.guard'

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().user
)

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
