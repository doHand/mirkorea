import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx  = host.switchToHttp()
    const res  = ctx.getResponse()
    const req  = ctx.getRequest()
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    const message = exception instanceof HttpException
      ? (exception.getResponse() as any)?.message || exception.message
      : '서버 오류가 발생했습니다'

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception))
    }

    res.status(status).json({ success: false, message, statusCode: status })
  }
}
