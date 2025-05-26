import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt, reencryptWithOldKey } from '@/lib/encryption';

// POST: Migrate passwords encrypted with old key to new key
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { oldEncryptionKey } = await request.json();
    
    if (!oldEncryptionKey) {
      return NextResponse.json({ error: 'Old encryption key is required' }, { status: 400 });
    }

    // Get all passwords for the user
    const passwords = await prisma.password.findMany({
      where: {
        userId: session.user.id,
      },
    });

    let migratedCount = 0;
    let failedCount = 0;

    // Migrate each password
    for (const password of passwords) {
      try {
        // Try to decrypt with old key and re-encrypt with new key
        const reencrypted = reencryptWithOldKey(password.password, oldEncryptionKey);
        
        if (reencrypted) {
          // Update the password with the re-encrypted value
          await prisma.password.update({
            where: { id: password.id },
            data: { password: reencrypted },
          });
          migratedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate password ${password.id}:`, error);
        failedCount++;
      }
    }

    // Get all password history entries for the user
    const historyEntries = await prisma.passwordHistory.findMany({
      where: {
        password: {
          userId: session.user.id,
        },
      },
    });

    let migratedHistoryCount = 0;
    let failedHistoryCount = 0;

    // Migrate each history entry
    for (const entry of historyEntries) {
      try {
        // Try to decrypt with old key and re-encrypt with new key
        const reencrypted = reencryptWithOldKey(entry.encryptedPassword, oldEncryptionKey);
        
        if (reencrypted) {
          // Update the history entry with the re-encrypted value
          await prisma.passwordHistory.update({
            where: { id: entry.id },
            data: { encryptedPassword: reencrypted },
          });
          migratedHistoryCount++;
        } else {
          failedHistoryCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate history entry ${entry.id}:`, error);
        failedHistoryCount++;
      }
    }

    // Get all secure notes for the user
    const notes = await prisma.secureNote.findMany({
      where: {
        userId: session.user.id,
      },
    });

    let migratedNotesCount = 0;
    let failedNotesCount = 0;

    // Migrate each note
    for (const note of notes) {
      try {
        // Try to decrypt with old key and re-encrypt with new key
        const reencrypted = reencryptWithOldKey(note.content, oldEncryptionKey);
        
        if (reencrypted) {
          // Update the note with the re-encrypted value
          await prisma.secureNote.update({
            where: { id: note.id },
            data: { content: reencrypted },
          });
          migratedNotesCount++;
        } else {
          failedNotesCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate note ${note.id}:`, error);
        failedNotesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      stats: {
        passwords: { migrated: migratedCount, failed: failedCount },
        passwordHistory: { migrated: migratedHistoryCount, failed: failedHistoryCount },
        notes: { migrated: migratedNotesCount, failed: failedNotesCount },
      },
    });
  } catch (error) {
    console.error('Error during encryption migration:', error);
    return NextResponse.json({ error: 'Internal server error during migration' }, { status: 500 });
  }
} 