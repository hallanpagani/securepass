'use client';

import { useState } from 'react';

export default function EncryptionMigrationTool() {
  const [oldKey, setOldKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<null | {
    success: boolean;
    message: string;
    stats?: {
      passwords: { migrated: number; failed: number };
      passwordHistory: { migrated: number; failed: number };
      notes: { migrated: number; failed: number };
    };
    error?: string;
  }>(null);

  const handleMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oldKey.trim()) {
      setResult({
        success: false,
        message: 'Please enter your old encryption key',
        error: 'Old encryption key is required'
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/migrate-encryption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldEncryptionKey: oldKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setResult({
        success: true,
        message: 'Migration completed successfully',
        stats: data.stats,
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Encryption Key Migration</h2>
      <p className="mb-4 text-gray-600 dark:text-gray-300">
        If you recently changed your encryption key, use this tool to migrate your existing data.
        Enter your previous encryption key to re-encrypt your data with the new key.
      </p>

      <form onSubmit={handleMigration} className="space-y-4">
        <div>
          <label htmlFor="old-key" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Previous Encryption Key
          </label>
          <input
            id="old-key"
            type="password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            value={oldKey}
            onChange={(e) => setOldKey(e.target.value)}
            placeholder="Enter your previous encryption key"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Migrating Data...
            </span>
          ) : 'Migrate Data'}
        </button>
      </form>

      {result && (
        <div className={`mt-4 p-3 rounded-md ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <p className={`font-medium ${result.success ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
            {result.message}
          </p>
          
          {result.error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{result.error}</p>
          )}
          
          {result.stats && (
            <div className="mt-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Passwords:</span> {result.stats.passwords.migrated} migrated, {result.stats.passwords.failed} failed
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Password History:</span> {result.stats.passwordHistory.migrated} migrated, {result.stats.passwordHistory.failed} failed
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Notes:</span> {result.stats.notes.migrated} migrated, {result.stats.notes.failed} failed
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p className="font-medium">Note:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>This tool only migrates data encrypted with your previous key.</li>
          <li>Incorrect previous key will result in failed migrations.</li>
          <li>This process cannot be undone.</li>
        </ul>
      </div>
    </div>
  );
} 