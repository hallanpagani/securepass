import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

// GET: Fetch a single note by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const note = await prisma.secureNote.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied.' }, { status: 404 });
    }

    try {
      const decryptedContent = decrypt(note.content);
      return NextResponse.json({ ...note, content: decryptedContent });
    } catch (e) {
      console.error(`Failed to decrypt content for note ${note.id}:`, e);
      return NextResponse.json({ 
        ...note, 
        content: 'Error: Could not decrypt content.',
        decryptionError: true 
      });
    }

  } catch (error) {
    console.error('Error fetching secure note:', error);
    return NextResponse.json({ error: 'Internal Server Error while fetching note.' }, { status: 500 });
  }
}

// PUT: Update an existing note
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    // Validate that at least one field is being updated
    if (title === undefined && content === undefined) {
      return NextResponse.json({ error: 'No fields provided for update.' }, { status: 400 });
    }
    if (title !== undefined && (typeof title !== 'string' && title !== null)) { // title can be explicitly set to null to remove it
        return NextResponse.json({ error: 'Title must be a string or null.' }, { status: 400 });
    }
    if (content !== undefined && typeof content !== 'string') {
        return NextResponse.json({ error: 'Content must be a string.' }, { status: 400 });
    }


    const existingNote = await prisma.secureNote.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found or access denied.' }, { status: 404 });
    }

    const updateData: { title?: string | null; content?: string } = {};
    if (title !== undefined) {
      updateData.title = title === null ? null : title.trim();
    }
    if (content !== undefined) {
      if (content.trim() === '') {
        return NextResponse.json({ error: "Content cannot be empty if provided for update." }, { status: 400 });
      }
      updateData.content = encrypt(content);
    }

    const updatedNote = await prisma.secureNote.update({
      where: {
        id: params.id,
        // userId: session.user.id, // Already confirmed ownership with findFirst
      },
      data: updateData,
    });
    
    // Return the updated note with decrypted content
    return NextResponse.json({
        ...updatedNote,
        content: decrypt(updatedNote.content)
    });

  } catch (error) {
    console.error('Error updating secure note:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while updating note.' }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const note = await prisma.secureNote.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied.' }, { status: 404 });
    }

    await prisma.secureNote.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ message: 'Note deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting secure note:', error);
    return NextResponse.json({ error: 'Internal Server Error while deleting note.' }, { status: 500 });
  }
}
