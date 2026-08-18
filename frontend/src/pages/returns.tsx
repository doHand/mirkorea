import type { GetServerSideProps } from 'next'

export default function ReturnsRedirect() {
  return null
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/inbound?tab=returns',
    permanent: false,
  },
})
