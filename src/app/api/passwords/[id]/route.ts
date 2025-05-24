import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions'; // Corrected path
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { // Ensure user.id is checked
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, username, password, url, tags: tagNames, isFavorite } = await request.json(); // Expect isFavorite

    // Validate input data (basic example)
    // Only require title, username for favorite toggle, but if password is provided, it must not be empty.
    // If other fields are provided, they will be updated. If only isFavorite is provided, only that changes.
    if (typeof title === 'string' && !title.trim() && 
        typeof username === 'string' && !username.trim() &&
        typeof password === 'string' && !password.trim() &&
        typeof isFavorite !== 'boolean') {
        // This check is a bit complex. If it's a full update, title/user/pass are needed.
        // If it's just a favorite toggle, only isFavorite is needed.
        // For simplicity, the frontend will send all fields when editing, and only isFavorite when toggling.
        // The API will update whatever is provided.
    }
    
    if (password !== undefined && password.length < 1 && existingPasswordEntry?.password !== password) {
      // If a new password is provided and it's empty, reject.
      // This allows sending undefined for password if not changing it.
      return NextResponse.json({ error: 'Password cannot be empty if you are attempting to change it.' }, { status: 400 });
    }


    const existingPasswordEntry = await prisma.password.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingPasswordEntry) {
      return NextResponse.json({ error: 'Password not found or access denied' }, { status: 404 });
    }

    // Archive the current password before updating
    // The current password in existingPasswordEntry.password is already encrypted
    // Archive only if the password string itself is being changed.
    if (password !== undefined && password !== existingPasswordEntry.password) { // Check if new password value is actually different
        // (Note: existingPasswordEntry.password is encrypted, `password` from req is plaintext)
        // This logic needs to be careful: if `password` from req is plaintext and different from decrypted old one, then archive.
        // For simplicity: if `password` field is present in request, assume it's an intentional update of the password value.
        // A better check would be to decrypt existingPasswordEntry.password and compare with `password` from request.
        // However, the current setup encrypts `password` from request *before* this comparison.
        // So, if `password` is in the request body, it means an intent to change it.
        
        // Let's refine: Archive if `password` is provided in the request AND it's different from the current one
        // (after the new one is encrypted). This means we encrypt first, then compare.
        // OR, more simply, if `password` is part of the request, the user intends to change it.
        // The current code encrypts `password` if present and updates.
        // We should archive `existingPasswordEntry.password` if `password` is in the request body.
        if (password !== undefined && existingPasswordEntry.password) {
            await prisma.passwordHistory.create({
                data: {
                    passwordEntryId: existingPasswordEntry.id,
                    encryptedPassword: existingPasswordEntry.password, 
                    // createdAt is set by default
                },
            });
        }
    }
    
    const userId = session.user.id;
    let newEncryptedPassword;
    if (password !== undefined) {
        newEncryptedPassword = encrypt(password); // Encrypt if new password is provided
    }


    const tagOperations = [];
    if (tagNames && Array.isArray(tagNames)) { // Allow empty array to clear tags
      for (const tagName of tagNames) {
        const normalizedTagName = tagName.trim();
        if (normalizedTagName) {
          let tag = await prisma.tag.findFirst({
            where: { userId, name: { equals: normalizedTagName, mode: 'insensitive' } },
          });
          if (!tag) {
            tag = await prisma.tag.create({
              data: { name: normalizedTagName, userId },
            });
          }
          tagOperations.push({ id: tag.id });
        }
      }
    }
    
    const updateData: any = {};

    // Add fields to updateData only if they are provided in the request
    if (title !== undefined) updateData.title = title;
    if (username !== undefined) updateData.username = username;
    if (newEncryptedPassword !== undefined) updateData.password = newEncryptedPassword; // only if password was in request
    if (url !== undefined) updateData.url = url;
    if (isFavorite !== undefined && typeof isFavorite === 'boolean') {
        updateData.isFavorite = isFavorite;
    }
    
    // updatedAt is handled by @updatedAt directive

    // Tag handling: only if tagNames is actually provided in the request payload
    if (tagNames !== undefined) { 
        if (Array.isArray(tagNames)) {
            for (const tagName of tagNames) {
                const normalizedTagName = tagName.trim();
                if (normalizedTagName) {
                    let tag = await prisma.tag.findFirst({
                        where: { userId, name: { equals: normalizedTagName, mode: 'insensitive' } },
                    });
                    if (!tag) {
                        tag = await prisma.tag.create({
                            data: { name: normalizedTagName, userId },
                        });
                    }
                    tagOperations.push({ id: tag.id });
                }
            }
            updateData.tags = {
                set: tagOperations, 
            };
        } else {
            // Handle case where tags might be explicitly set to null or non-array (error or ignore)
            // For now, if tagNames is defined but not an array, it's likely a bad request or we ignore.
            // If it's an empty array, `set: []` correctly clears tags.
        }
    }
    
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
    }


    const updatedPassword = await prisma.password.update({
      where: {
        id: params.id,
        userId: session.user.id, // Ensure user owns this password for update
      },
      data: updateData,
      include: { 
        tags: { select: { id: true, name: true } },
      }
    });

    // Decrypt password for response if needed by frontend, or send as is
    // For now, sending it encrypted as other fields are primary for display after update.
    // If client needs decrypted version immediately, decrypt updatedPassword.password here.
    return NextResponse.json(updatedPassword);
  } catch (error) {
    console.error('Error updating password:', error);
    // Consider more specific error messages if possible
    if (error instanceof SyntaxError) { // Malformed JSON
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while updating password.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { // Ensure user.id is checked
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingPasswordEntry = await prisma.password.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingPasswordEntry) {
      return NextResponse.json({ error: 'Password not found or access denied' }, { status: 404 });
    }

    // Related PasswordHistory and implicit _PasswordTags entries will be handled by Prisma.
    // For _PasswordTags, Prisma manages the relation table.
    // For PasswordHistory, onDelete: Cascade handles it.
    await prisma.password.delete({
      where: {
        id: params.id,
        userId: session.user.id, // Ensure user owns this password for delete
      },
    });

    return NextResponse.json({ message: 'Password deleted successfully.' });
  } catch (error) {
    console.error('Error deleting password:', error);
    return NextResponse.json({ error: 'Internal Server Error while deleting password.' }, { status: 500 });
  }
}