import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { decrypt, safeDecrypt } from '@/lib/encryption';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passwordId = params.id;

    // Verify that the password entry belongs to the user
    const passwordEntry = await prisma.password.findFirst({
      where: {
        id: passwordId,
        userId: session.user.id,
      },
    });

    if (!passwordEntry) {
      return NextResponse.json({ error: 'Password entry not found or access denied' }, { status: 404 });
    }

    const historyEntries = await prisma.passwordHistory.findMany({
      where: {
        passwordEntryId: passwordId,
      },
      orderBy: {
        createdAt: 'desc', // Show newest history first
      },
    });

    const decryptedHistory = historyEntries.map(entry => {
      try {
        return {
          ...entry,
          password: safeDecrypt(entry.encryptedPassword), // Use safeDecrypt for better error handling
          decryptionError: false
        };
      } catch (decryptionError) {
        console.error(`Failed to decrypt history entry ${entry.id}:`, decryptionError);
        return {
          ...entry,
          password: '[Decryption Failed]',
          decryptionError: true,
        };
      }
    });

    return NextResponse.json(decryptedHistory);

  } catch (error) {
    console.error('Error fetching password history:', error);
    return NextResponse.json({ error: 'Internal Server Error while fetching password history.' }, { status: 500 });
  }
}
