'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // Or for redirecting after success if needed

export default function TwoFactorAuthPrompt() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!totpCode || totpCode.length !== 6 || !/^\d{6}$/.test(totpCode)) {
      setError('Please enter a valid 6-digit TOTP code.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/2fa/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totpToken: totpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate 2FA token.');
      }

      // Successful authentication from API
      // Now, update the NextAuth session to reflect that 2FA is no longer pending.
      // The `jwt` callback in `authOptions.ts` should handle { event: '2faAuthenticated' }
      const updatedSession = await updateSession({ event: '2faAuthenticated' });

      if (updatedSession?.error) {
        // This error would be from the session update process itself via NextAuth
        throw new Error(updatedSession.error);
      }
      
      if (updatedSession && !updatedSession.user?.is2FAPending) {
        // Session updated successfully, 2FA is no longer pending.
        // The parent component (Dashboard) will re-render due to session update.
        // No explicit redirect is needed here if Dashboard handles the conditional rendering.
        // router.push('/dashboard'); // Or simply let the parent re-render
      } else {
        // This case should ideally not be reached if updateSession worked as expected
        setError('Session update failed after 2FA. Please try signing in again.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error('2FA Authentication error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-center text-gray-600 dark:text-gray-300">
          Enter the code from your authenticator app.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="totp-code" className="sr-only">
              Verification Code
            </label>
            <input
              id="totp-code"
              name="totpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              minLength={6}
              pattern="\d{6}"
              className="block w-full px-4 py-3 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-wider"
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Verify Code'
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          If you are having trouble, please ensure your device's time is synchronized.
        </p>
      </div>
    </div>
  );
}
