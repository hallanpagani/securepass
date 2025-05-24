import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
// Encrypt/decrypt functions are not directly needed here if we are just moving encrypted data
// However, if the main password table stores decrypted passwords and history stores encrypted,
// then encryption would be needed when moving from main to history.
// Assuming main table's 'password' field is ALREADY ENCRYPTED, matching history.

export async function POST(
  request: Request,
  { params }: { params: { id: string } } // This 'id' is the passwordEntryId
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passwordEntryId = params.id;
    const { historyId } = await request.json();

    if (!historyId) {
      return NextResponse.json({ error: 'History ID is required for revert.' }, { status: 400 });
    }

    // 1. Retrieve the PasswordHistory entry to revert to
    const historicalPassword = await prisma.passwordHistory.findUnique({
      where: {
        id: historyId,
        passwordEntryId: passwordEntryId, // Ensure it belongs to the correct password entry
      },
    });

    if (!historicalPassword) {
      return NextResponse.json({ error: 'Historical password version not found.' }, { status: 404 });
    }

    // 2. Retrieve the current main Password entry
    const currentPasswordEntry = await prisma.password.findFirst({
      where: {
        id: passwordEntryId,
        userId: session.user.id, // Security check: user owns this password entry
      },
    });

    if (!currentPasswordEntry) {
      return NextResponse.json({ error: 'Current password entry not found or access denied.' }, { status: 404 });
    }

    // 3. Archive the *current* main password to PasswordHistory before overwriting it
    // The password in currentPasswordEntry.password is assumed to be already encrypted.
    if (currentPasswordEntry.password) { // Check if there's a password to archive
        await prisma.passwordHistory.create({
            data: {
                passwordEntryId: currentPasswordEntry.id,
                encryptedPassword: currentPasswordEntry.password, 
                // createdAt will be set by default
            },
        });
    }
    
    // 4. Update the main Password entry with the password from the selected PasswordHistory entry
    // The historicalPassword.encryptedPassword is already in the correct encrypted format.
    const updatedPassword = await prisma.password.update({
      where: {
        id: passwordEntryId,
      },
      data: {
        password: historicalPassword.encryptedPassword, // Set to the historical encrypted password
        // The title, username, url, description etc., remain unchanged unless specified
        // updatedAt will be updated automatically
      },
    });

    return NextResponse.json({ success: true, message: 'Password reverted successfully.', revertedPassword: updatedPassword });

  } catch (error) {
    console.error('Error reverting password:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request payload (JSON).' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while reverting password.' }, { status: 500 });
  }
}
