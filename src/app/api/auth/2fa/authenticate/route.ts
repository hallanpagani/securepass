import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjusted path
import prisma from '@/lib/prisma';
import speakeasy from 'speakeasy';
import { getToken } from 'next-auth/jwt'; // To access raw JWT

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions); // Gets parsed session, not raw JWT
  const jwtToken = await getToken({ req }); // Gets raw JWT

  if (!session?.user?.id || !jwtToken) {
    return NextResponse.json({ error: 'Unauthorized: User session or JWT token not found.' }, { status: 401 });
  }

  // Crucially, check if 2FA was pending for this user in their current JWT
  if (!jwtToken.is2FAPending) {
    // If 2FA is not pending, either it's already completed, or not enabled.
    // This endpoint should only be used when 2FA is the immediate next step.
    return NextResponse.json({ error: '2FA is not pending for this session.' }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    const { totpToken } = await req.json();
    if (!totpToken) {
      return NextResponse.json({ error: 'TOTP token is required.' }, { status: 400 });
    }

    // Safely get user 2FA data
    let user;
    let is2FAEnabled = false;
    let twoFactorSecret = null;
    
    try {
      user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (user) {
        is2FAEnabled = user.isTwoFactorEnabled === true;
        twoFactorSecret = user.twoFactorSecret;
      }
    } catch (error) {
      console.error('Error fetching user 2FA data:', error);
      return NextResponse.json({ error: 'Error fetching user 2FA configuration.' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!is2FAEnabled || !twoFactorSecret) {
      // This case should ideally not be hit if is2FAPending was true,
      // as that implies 2FA is enabled and secret exists.
      return NextResponse.json({ error: '2FA is not properly configured for this user.' }, { status: 400 });
    }

    const verified = speakeasy.totp.verify({
      secret: twoFactorSecret,
      encoding: 'base32',
      token: totpToken,
      window: 1, 
    });

    if (verified) {
      // IMPORTANT: Verification successful.
      // The session update (is2FAPending: false) needs to happen.
      // This API route itself cannot directly modify the NextAuth JWT cookie securely.
      // It signals success to the client. The client MUST then call `useSession().update({ event: '2faAuthenticated' })`
      // or similar, which will re-trigger the `jwt` and `session` callbacks in `authOptions.ts`.
      // Those callbacks will then update `is2FAPending` to `false`.
      return NextResponse.json({ success: true, message: '2FA authenticated successfully.' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid TOTP token.' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error authenticating 2FA token:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error during 2FA authentication.' }, { status: 500 });
  }
}
