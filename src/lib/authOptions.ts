import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/prisma';

interface DbUser extends NextAuthUser {
  id: string;
  isTwoFactorEnabled?: boolean | null;
  twoFactorSecret?: string | null;
}

// Helper function to safely get user 2FA status
const getUserTwoFactorStatus = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    // Return 2FA status if field exists, otherwise default to false
    return {
      isTwoFactorEnabled: user?.isTwoFactorEnabled === true,
    };
  } catch (error) {
    console.error('Error fetching user 2FA status:', error);
    // If field doesn't exist in schema, default to false
    return {
      isTwoFactorEnabled: false,
    };
  }
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    // Define the 2FA page
    error: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user?.id) return false;

      // We don't need to check for 2FA fields here
      // Just verify the user exists
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      return !!dbUser;
    },

    async jwt({ token, user, account, profile, trigger, session: sessionFromUpdate }) {
      // If this is the initial sign-in
      if (account && user) {
        // Set the token properties from the user object
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        // Safely get 2FA status using our helper function
        const twoFactorStatus = await getUserTwoFactorStatus(user.id);
        token.isTwoFactorEnabled = twoFactorStatus.isTwoFactorEnabled;
        token.is2FAPending = twoFactorStatus.isTwoFactorEnabled;
      }

      // Handle session updates
      if (trigger === "update" && sessionFromUpdate) {
        // If client called updateSession({ event: "2faAuthenticated" })
        if ((sessionFromUpdate as any).event === "2faAuthenticated") {
          if (token.isTwoFactorEnabled) {
            token.is2FAPending = false;
          }
        }
        
        // If client called updateSession(true) or updateSession({})
        if (token.id) {
          const twoFactorStatus = await getUserTwoFactorStatus(token.id as string);
          token.isTwoFactorEnabled = twoFactorStatus.isTwoFactorEnabled;
          if (!twoFactorStatus.isTwoFactorEnabled) {
            token.is2FAPending = false;
          }
        }
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled;
        session.user.is2FAPending = token.is2FAPending;
      }
      return session;
    },
  },
  // debug: process.env.NODE_ENV === 'development',
};
