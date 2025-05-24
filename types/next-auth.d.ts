import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: {
      id?: string | null;
      isTwoFactorEnabled?: boolean | null;
      is2FAPending?: boolean | null; // Indicates if 2FA step is required after primary auth
    } & DefaultSession["user"];
    error?: string | null; 
  }

  interface User extends DefaultUser {
    id: string; 
    isTwoFactorEnabled?: boolean | null;
    twoFactorSecret?: string | null; 
    // is2FAPending is more of a session/token state than a user DB property
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    isTwoFactorEnabled?: boolean | null;
    is2FAPending?: boolean | null; // True if user has authenticated but needs to pass 2FA
    tempTwoFactorSecret?: string | null; // For storing secret during 2FA setup process
  }
}
