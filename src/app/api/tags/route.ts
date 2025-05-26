import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';

// GET: Fetch all tags for the logged-in user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only check for 2FA if it's enabled
  if (session.user.isTwoFactorEnabled && session.user.is2FAPending) {
    return NextResponse.json({ error: 'Please complete 2FA verification' }, { status: 401 });
  }

  try {
    const tags = await prisma.tag.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Internal Server Error while fetching tags.' }, { status: 500 });
  }
}

// POST: Create a new tag for the logged-in user
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only check for 2FA if it's enabled
  if (session.user.isTwoFactorEnabled && session.user.is2FAPending) {
    return NextResponse.json({ error: 'Please complete 2FA verification' }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Tag name is required and must be a non-empty string.' }, { status: 400 });
    }

    const tagName = name.trim();
    const userId = session.user.id;

    // Check if tag already exists for this user (case-insensitive check, but store with original casing or consistent casing)
    // Prisma's unique constraint is case-sensitive by default on most DBs.
    // To enforce case-insensitivity at application level for creation:
    const existingTag = await prisma.tag.findFirst({
      where: {
        userId: userId,
        name: {
          equals: tagName,
          mode: 'insensitive', // Prisma specific for case-insensitive search
        },
      },
    });

    if (existingTag) {
      // Return the existing tag instead of an error, or an error if strict creation is needed.
      // For this, let's return the existing tag, as the user might be trying to "add" it again.
      return NextResponse.json(existingTag, { status: 200 }); 
      // Or, if you want to signal it exists:
      // return NextResponse.json({ error: `Tag '${tagName}' already exists.` }, { status: 409 });
    }

    // Create the new tag
    const newTag = await prisma.tag.create({
      data: {
        name: tagName, // Store with the casing provided, or normalize (e.g., to lowercase)
        userId: userId,
      },
    });
    return NextResponse.json(newTag, { status: 201 }); // 201 Created
  } catch (error: any) {
    console.error('Error creating tag:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('userId') && error.meta?.target?.includes('name')) {
      // This handles the case where `mode: 'insensitive'` check might miss due to DB collation
      // or if we didn't use insensitive mode and relied on DB unique constraint.
      return NextResponse.json({ error: 'Tag already exists for this user (database constraint).' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error while creating tag.' }, { status: 500 });
  }
}
