'use client';

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();

  // 2FA States from Dashboard
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [tempSecret, setTempSecret] = useState<string>('');

  // Prioritize updatedSession if available, otherwise fall back to initial session data
  // For settings page, we directly use session from useSession()
  const isTwoFactorEnabled = session?.user?.isTwoFactorEnabled ?? false;
  // const is2FAPending = session?.user?.is2FAPending ?? false; // This might not be needed here if settings page is protected by layout

  const handleEnable2FASetup = useCallback(async () => {
    console.log('Attempting to enable 2FA setup from settings.');
    setIs2FALoading(true);
    setTwoFactorError(null);
    setQrCodeDataUrl('');
    setTotpCode('');
    setTempSecret('');
    try {
      const response = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start 2FA setup.');
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setTempSecret(data.secret);
      setIs2FAModalOpen(true);
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setIs2FALoading(false);
    }
  }, []); // Dependencies: updateSession if it were used inside, but it is not for setup trigger

  const handleVerify2FAToken = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIs2FALoading(true);
    setTwoFactorError(null);
    try {
      if (!tempSecret) {
        throw new Error('Temporary secret is missing. Please try setting up 2FA again.');
      }
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpCode, secret: tempSecret }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify token.');
      }
      alert('2FA enabled successfully!');
      setIs2FAModalOpen(false);
      setTotpCode('');
      setQrCodeDataUrl('');
      setTempSecret('');
      await updateSession(true); // Refresh session to get updated 2FA status
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'An unknown error occurred. Ensure the code is correct and try again.');
    } finally {
      setIs2FALoading(false);
    }
  }, [totpCode, tempSecret, updateSession]);

  const handleDisable2FA = useCallback(async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
    setIs2FALoading(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/auth/2fa/disable', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable 2FA.');
      }
      alert('2FA disabled successfully!');
      await updateSession(true); // Refresh session
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'An unknown error occurred.');
      alert(error instanceof Error ? error.message : 'An unknown error occurred while disabling 2FA.');
    } finally {
      setIs2FALoading(false);
    }
  }, [updateSession]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="py-2 px-4 font-medium text-sm text-blue-600 border-b-2 border-blue-600">
          Account
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication (2FA)</h2>
        {twoFactorError && !is2FAModalOpen && <p className="text-red-500 dark:text-red-400 text-sm mb-3">{twoFactorError}</p>}
        {isTwoFactorEnabled ? (
          <div>
            <p className="text-green-600 dark:text-green-400 mb-3">2FA is currently enabled for your account.</p>
            <button
              onClick={handleDisable2FA}
              disabled={is2FALoading}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
            >
              {is2FALoading && <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>}
              Disable 2FA
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Enhance your account security by enabling 2FA.</p>
            <button
              onClick={handleEnable2FASetup}
              disabled={is2FALoading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {is2FALoading && !is2FAModalOpen && <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>}
              Enable 2FA
            </button>
          </div>
        )}
      </div>

      {is2FAModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Enable Two-Factor Authentication</h2>
            {twoFactorError && <p className="text-red-500 dark:text-red-400 text-sm mb-3">{twoFactorError}</p>}
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy).
            </p>
            {is2FALoading && !qrCodeDataUrl ? ( 
                <div className="flex justify-center items-center h-40 my-4">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code for 2FA" className="mx-auto my-4 border dark:border-gray-600" />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 my-4">QR Code will appear here.</p> 
            )}
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Then, enter the 6-digit code from your app to verify and complete setup.
            </p>
            <form onSubmit={handleVerify2FAToken} className="space-y-4 mt-4">
              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Verification Code</label>
                <input
                  id="totp-code"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg tracking-wider"
                  placeholder="123456"
                  required
                  maxLength={6}
                  minLength={6}
                  pattern="\d{6}"
                  title="Enter a 6-digit code"
                  disabled={is2FALoading}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIs2FAModalOpen(false); 
                    setQrCodeDataUrl(''); 
                    setTotpCode(''); 
                    setTempSecret('');
                    setTwoFactorError(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={is2FALoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2 w-36"
                  disabled={is2FALoading || !totpCode || totpCode.length !== 6}
                >
                  {is2FALoading ? (
                     <>
                       <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                       Verifying...
                     </>
                  ) : (
                    'Verify & Enable'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Other Account Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">
          More account settings will be available in a future update.
        </p>
      </div>
    </div>
  );
} 