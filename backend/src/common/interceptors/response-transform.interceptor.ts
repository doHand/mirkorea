import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // 이미 { success, data } 형태면 그대로
        if (data && typeof data === 'object' && 'success' in data) return data
        return { success: true, data }
      })
    )
  }
}
