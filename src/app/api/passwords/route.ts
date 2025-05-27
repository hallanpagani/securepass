import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions'; // Corrected path
import prisma from '@/lib/prisma';
import { encrypt, decrypt, safeDecrypt } from '@/lib/encryption';

export async function GET(request: Request) { // Added request parameter
  try {
    console.log('Password API: GET request received');
    
    // Debug database connection
    try {
      console.log('Password API: Testing database connection...');
      await prisma.$queryRaw`SELECT 1`;
      console.log('Password API: Database connection successful');
    } catch (dbError) {
      console.error('Password API: Database connection failed:', dbError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const session = await getServerSession(authOptions);
    console.log('Password API: Session retrieved:', !!session);
    
    if (!session?.user?.id) { // Check for user.id
      console.log('Password API: No user ID found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Password API: User ID found:', session.user.id);

    // Only check for 2FA if it's enabled
    if (session.user.isTwoFactorEnabled && session.user.is2FAPending) {
      console.log('Password API: 2FA pending, rejecting request');
      return NextResponse.json({ error: 'Please complete 2FA verification' }, { status: 401 });
    }

    console.log('Password API: Fetching passwords for user:', session.user.id);
    try {
      const passwords = await prisma.password.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          tags: { // Include tags in the response
            select: { id: true, name: true } // Select only necessary fields from Tag
          } 
        }
      });
      console.log('Password API: Found passwords count:', passwords.length);

      const decryptedPasswords = passwords.map(password => {
        try {
          return {
            ...password,
            password: safeDecrypt(password.password),
            decryptionError: false
          };
        } catch (error) {
          console.error(`Failed to decrypt password for entry ${password.id}:`, error);
          return {
            ...password,
            password: '[Decryption Failed]',
            decryptionError: true
          };
        }
      });

      console.log('Password API: Returning decrypted passwords count:', decryptedPasswords.length);
      return NextResponse.json(decryptedPasswords);
    } catch (queryError) {
      console.error('Password API: Error in database query:', queryError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching passwords:', error);
    return NextResponse.json({ error: 'Internal Server Error while fetching passwords.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { // Check for user.id
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only check for 2FA if it's enabled
    if (session.user.isTwoFactorEnabled && session.user.is2FAPending) {
      return NextResponse.json({ error: 'Please complete 2FA verification' }, { status: 401 });
    }

    const { title, username, password, url, tags: tagNames } = await request.json(); // Expect tagNames as an array of strings

    if (!title || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields: title, username, password' }, { status: 400 });
    }
    if (password.length < 1) {
        return NextResponse.json({ error: 'Password cannot be empty.' }, { status: 400 });
    }

    const encryptedPassword = encrypt(password);
    const userId = session.user.id;

    const tagOperations = [];
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        const normalizedTagName = tagName.trim();
        if (normalizedTagName) {
          // Find existing tag or prepare to create one
          // Using a loop with individual finds and then creates if not found,
          // or more complex upsert logic if Prisma version supports it well for many-to-many from strings.
          // For simplicity, let's ensure tags exist or create them before password creation.
          // This isn't the most atomic way but works for now.
          
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

    const newPasswordData: any = {
      title,
      username,
      password: encryptedPassword,
      url,
      userId: userId,
    };

    if (tagOperations.length > 0) {
      newPasswordData.tags = {
        connect: tagOperations, // Connect to existing or newly created tags by their IDs
      };
    }

    const newPassword = await prisma.password.create({
      data: newPasswordData,
      include: { // Include tags in the response
        tags: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(newPassword, { status: 201 });
  } catch (error) {
    console.error('Error creating password:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while creating password.' }, { status: 500 });
  }
}