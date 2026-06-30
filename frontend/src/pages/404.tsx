import Head from 'next/head'
import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <Head>
        <title>페이지를 찾을 수 없습니다 | WMS Pro</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f5f7f4] text-[#344039]">
        <p className="text-8xl font-bold text-[#2f6f58]">404</p>
        <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-[#79867f]">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <Link
          href="/login"
          className="mt-4 rounded-md bg-[#2f6f58] px-5 py-2 text-sm font-medium text-white hover:bg-[#245646]"
        >
          로그인 페이지로 이동
        </Link>
      </div>
    </>
  )
}
