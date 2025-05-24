import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjusted path
import prisma from '@/lib/prisma';
import speakeasy from 'speakeasy';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized: User session not found.' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { token: totpToken, secret: tempSecret } = await req.json();

    if (!totpToken) {
      return NextResponse.json({ error: 'TOTP token is required.' }, { status: 400 });
    }
    if (!tempSecret) {
      return NextResponse.json({ error: 'Temporary secret is required for verification.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // If 2FA is already enabled, this route should perhaps not be used,
    // or it should behave differently (e.g., for verifying a login attempt).
    // For initial setup, we assume 2FA is not yet enabled.
    if (user.isTwoFactorEnabled) {
        // This could mean they are trying to re-verify an existing setup.
        // Or, it's an attempt to enable an already enabled 2FA.
        // For simplicity, let's prevent re-enabling if already enabled.
        return NextResponse.json({ error: '2FA is already enabled and verified for this account.'}, { status: 400 });
    }

    const verified = speakeasy.totp.verify({
      secret: tempSecret, // Use the temporary secret provided by the client from setup phase
      encoding: 'base32',
      token: totpToken,
      window: 1, // Allow for a 30-second window (one token on either side)
    });

    if (verified) {
      // Verification successful, now permanently store the secret and enable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: { 
          twoFactorSecret: tempSecret, // Store the verified secret
          isTwoFactorEnabled: true 
        },
      });
      // The session update (isTwoFactorEnabled: true) will be handled by the client
      // calling updateSession(), which triggers callbacks in authOptions.
      return NextResponse.json({ success: true, message: '2FA enabled successfully.' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid TOTP token. Please try again.' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    if (error instanceof SyntaxError) { // Handle malformed JSON
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error during token verification.' }, { status: 500 });
  }
}
