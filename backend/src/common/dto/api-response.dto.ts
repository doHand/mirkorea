export class ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  pagination?: { page: number; limit: number; total: number; totalPages: number }

  static ok<T>(data: T, message?: string): ApiResponse<T> {
    return { success: true, data, message }
  }
  static fail(message: string): ApiResponse<null> {
    return { success: false, message }
  }
}

export class PaginationDto {
  page?:   number = 1
  limit?:  number = 50
  search?: string
}
