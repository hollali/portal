import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('session')?.value
  const session = token ? verifyToken(token) : null

  if (pathname.startsWith('/login')) {
    if (session && (session.role === 'admin' || session.role === 'editor' || session.role === 'viewer')) {
      const dest = request.nextUrl.searchParams.get('next') || '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!session || !(session.role === 'admin' || session.role === 'editor' || session.role === 'viewer')) {
      const url = new URL('/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login'],
}