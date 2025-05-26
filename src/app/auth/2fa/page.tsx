'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import TwoFactorAuthPrompt from '@/components/TwoFactorAuthPrompt';

export default function TwoFactorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If user is not authenticated, redirect to sign-in
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    // If user is authenticated but 2FA is not pending, redirect to dashboard
    if (status === 'authenticated' && 
        (!session?.user?.isTwoFactorEnabled || !session?.user?.is2FAPending)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show the 2FA prompt if authentication is required
  if (status === 'authenticated' && session?.user?.isTwoFactorEnabled && session?.user?.is2FAPending) {
    return <TwoFactorAuthPrompt />;
  }

  return null; // This will rarely render as the useEffect will redirect
} 