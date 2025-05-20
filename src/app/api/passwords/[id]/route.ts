import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, username, password, url } = await request.json();

    const existingPassword = await prisma.password.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingPassword) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }

    const encryptedPassword = encrypt(password);

    const updatedPassword = await prisma.password.update({
      where: {
        id: params.id,
      },
      data: {
        title,
        username,
        password: encryptedPassword,
        url,
      },
    });

    return NextResponse.json(updatedPassword);
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingPassword = await prisma.password.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingPassword) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }

    await prisma.password.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ message: 'Password deleted successfully' });
  } catch (error) {
    console.error('Error deleting password:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 