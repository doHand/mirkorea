import { QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axios from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          30_000,  // 30초
      gcTime:             5 * 60_000,
      retry:              1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        if (axios.isAxiosError(error)) {
          const msg = error.response?.data?.message || '요청 처리 중 오류가 발생했습니다'
          toast.error(msg)
        }
      },
    },
  },
})
