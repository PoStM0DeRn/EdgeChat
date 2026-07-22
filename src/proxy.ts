import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/((?!login|register|landing|api/auth|api/agent/verify|api/stripe/webhook|api/upload|api/view|comfyui|_next|favicon.ico|globals.css).*)',
  ],
}
