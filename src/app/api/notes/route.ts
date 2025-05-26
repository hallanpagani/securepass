import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt, safeDecrypt } from '@/lib/encryption';

// GET: Fetch all notes for the logged-in user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const notes = await prisma.secureNote.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const decryptedNotes = notes.map(note => {
      try {
        return {
          ...note,
          content: safeDecrypt(note.content),
          decryptionError: false
        };
      } catch (e) {
        console.error(`Failed to decrypt content for note ${note.id}:`, e);
        return {
          ...note,
          content: '[Decryption Failed]',
          decryptionError: true,
        };
      }
    });

    return NextResponse.json(decryptedNotes);
  } catch (error) {
    console.error('Error fetching secure notes:', error);
    return NextResponse.json({ error: 'Internal Server Error while fetching notes.' }, { status: 500 });
  }
}

// POST: Create a new note for the logged-in user
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    if (typeof content !== 'string' || content.trim() === '') { // Content is required
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }
    if (title && typeof title !== 'string') {
        return NextResponse.json({ error: 'Title must be a string.' }, { status: 400 });
    }


    const encryptedContent = encrypt(content);

    const newNote = await prisma.secureNote.create({
      data: {
        title: title ? title.trim() : null,
        content: encryptedContent,
        userId: session.user.id,
      },
    });

    // Return the created note with decrypted content
    return NextResponse.json({
        ...newNote,
        content: content, // Return the original content instead of decrypting again
        decryptionError: false
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating secure note:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while creating note.' }, { status: 500 });
  }
}
