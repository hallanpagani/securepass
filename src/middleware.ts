import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Check if trying to access API routes
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  
  // Allow auth-related paths (signin, signout, etc.) and non-API routes
  if (
    !isApiRoute ||
    request.nextUrl.pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Ensure API routes are protected
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If user has 2FA enabled and it's still pending verification,
  // deny access to API routes
  if (token.isTwoFactorEnabled && token.is2FAPending) {
    return NextResponse.json({ error: 'Please complete 2FA verification' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes except auth endpoints
    '/api/:path*',
  ],
}; 