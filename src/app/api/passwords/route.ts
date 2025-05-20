import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passwords = await prisma.password.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const decryptedPasswords = passwords.map(password => ({
      ...password,
      password: decrypt(password.password),
    }));

    return NextResponse.json(decryptedPasswords);
  } catch (error) {
    console.error('Error fetching passwords:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, username, password, url } = await request.json();

    const encryptedPassword = encrypt(password);

    const newPassword = await prisma.password.create({
      data: {
        title,
        username,
        password: encryptedPassword,
        url,
        userId: session.user.id,
      },
    });

    return NextResponse.json(newPassword);
  } catch (error) {
    console.error('Error creating password:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 