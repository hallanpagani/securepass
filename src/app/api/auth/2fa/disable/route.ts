import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjusted path
import prisma from '@/lib/prisma';

export async function POST(req: Request) { // POST is appropriate for a state-changing operation
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized: User session not found.' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Safely get user and check 2FA status
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Check if 2FA is enabled - safely handle field issues
    let is2FAEnabled = false;
    try {
      is2FAEnabled = user.isTwoFactorEnabled === true;
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      // Continue as if 2FA is not enabled
    }

    if (!is2FAEnabled) {
      return NextResponse.json({ error: '2FA is not currently enabled for this account.' }, { status: 400 });
    }

    // For enhanced security, one might require current TOTP or password here.
    // For this implementation, being authenticated is sufficient.

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isTwoFactorEnabled: false,
          twoFactorSecret: null, // Clear the secret from the database
        },
      });
    } catch (error) {
      console.error('Error updating user 2FA data:', error);
      return NextResponse.json({ error: 'Failed to disable 2FA. Database update failed.' }, { status: 500 });
    }

    // The session update (isTwoFactorEnabled: false) will be handled by the client
    // calling updateSession(), which triggers callbacks in authOptions.
    return NextResponse.json({ success: true, message: '2FA disabled successfully.' });

  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json({ error: 'Internal server error while disabling 2FA.' }, { status: 500 });
  }
}
