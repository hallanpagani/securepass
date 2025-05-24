import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/prisma';

interface DbUser extends NextAuthUser {
  id: string;
  isTwoFactorEnabled?: boolean | null;
  twoFactorSecret?: string | null;
}

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
    // A page like /auth/2fa-prompt will be where client redirects if session.user.is2FAPending is true
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user?.id) return false;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isTwoFactorEnabled: true, id: true } 
      });

      if (!dbUser) return false;
      
      // Allow sign-in to proceed to JWT callback. JWT callback will manage 2FA pending state.
      return true;
    },

    async jwt({ token, user, account, profile, trigger, session: sessionFromUpdate }) {
      if (user?.id) { // Initial sign-in
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isTwoFactorEnabled: true, email: true, name: true, image: true } 
        });
        
        if (dbUser) {
          token.isTwoFactorEnabled = !!dbUser.isTwoFactorEnabled;
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;

          if (dbUser.isTwoFactorEnabled) {
            token.is2FAPending = true; // Mark 2FA as pending
          } else {
            token.is2FAPending = false;
          }
        }
      }

      // Handle session updates, specifically after 2FA actions
      if (trigger === "update" && sessionFromUpdate) {
        // If client called updateSession({ event: "2faAuthenticated" })
        if ((sessionFromUpdate as any).event === "2faAuthenticated") {
          if (token.isTwoFactorEnabled) { // Ensure 2FA is still relevant
             token.is2FAPending = false; // 2FA is now completed for this session
          }
        }
        
        // If client called updateSession(true) or updateSession({}) for other reasons (e.g. after enabling/disabling 2FA)
        // Re-fetch user's 2FA status from DB to ensure token is fresh
        if (token.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: token.id as string },
                select: { isTwoFactorEnabled: true }
            });
            if (dbUser) {
                token.isTwoFactorEnabled = !!dbUser.isTwoFactorEnabled;
                // If 2FA was just disabled, ensure is2FAPending is also false.
                if (!dbUser.isTwoFactorEnabled) {
                    token.is2FAPending = false;
                }
            }
        }
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean | null;
      session.user.is2FAPending = token.is2FAPending as boolean | null;
      
      if (token.email) session.user.email = token.email;
      if (token.name) session.user.name = token.name;
      if (token.picture) session.user.image = token.picture;

      return session;
    },
  },
  // debug: process.env.NODE_ENV === 'development',
};
