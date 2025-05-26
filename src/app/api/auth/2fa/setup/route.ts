import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjusted path
import prisma from '@/lib/prisma';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { getToken } from 'next-auth/jwt'; // For accessing JWT

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized: User session not found or email missing.' }, { status: 401 });
  }
  
  const token = await getToken({ req });
  if (!token) {
      return NextResponse.json({ error: 'Unauthorized: JWT token not found.' }, { status: 401 });
  }

  try {
    // Check if 2FA is already enabled - safely handle potential missing field
    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: session.user.id } });
      // Only check if the field exists and is true
      if (user && user.isTwoFactorEnabled === true) {
        return NextResponse.json({ error: '2FA is already enabled.' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      // Continue with setup if there's an error (field might not exist yet)
    }

    const secret = speakeasy.generateSecret({
      name: `SecurePass (${session.user.email})`, // App name and user identifier
      length: 32, // Longer secret for better security
    });

    // The secret.base32 is what needs to be stored temporarily or sent to client for verification step
    // The otpauth_url is for the QR code
    if (!secret.otpauth_url) {
        return NextResponse.json({ error: 'Failed to generate OTP Auth URL' }, { status: 500 });
    }
    
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Send the QR code and the secret to the client.
    // The client will need to send this secret back to the /verify endpoint.
    // This is a way of "temporarily storing" the secret on the client-side.
    return NextResponse.json({ qrCodeDataUrl, secret: secret.base32 });

  } catch (error) {
    console.error('Error setting up 2FA:', error);
    return NextResponse.json({ error: 'Internal server error during 2FA setup.' }, { status: 500 });
  }
}
