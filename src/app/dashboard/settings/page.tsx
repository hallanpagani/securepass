'use client';

import { useState } from 'react';
import EncryptionMigrationTool from '@/components/EncryptionMigrationTool';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('encryption');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 font-medium text-sm ${
            activeTab === 'encryption'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('encryption')}
        >
          Encryption
        </button>
        <button
          className={`py-2 px-4 font-medium text-sm ${
            activeTab === 'account'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('account')}
        >
          Account
        </button>
      </div>

      {activeTab === 'encryption' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Encryption Settings</h2>
          <p className="mb-6 text-gray-600">
            Your data is encrypted using AES-256-GCM encryption. If you've recently
            changed your encryption key, you can use the migration tool below to
            re-encrypt your data with the new key.
          </p>
          
          <EncryptionMigrationTool />
          
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-100 rounded-md">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">Important Security Information</h3>
            <p className="text-sm text-yellow-700">
              Your encryption key is stored in your .env file and is used to encrypt and decrypt
              your sensitive data. Never share this key with anyone. If you lose your encryption key,
              you will not be able to recover your encrypted data.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
          <p className="text-gray-600">
            Account settings will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
} 