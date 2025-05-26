'use client';

import { useState } from 'react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="flex border-b border-gray-200 mb-6">
        <div className="py-2 px-4 font-medium text-sm text-blue-600 border-b-2 border-blue-600">
          Account
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
        <p className="text-gray-600">
          Account settings will be available in a future update.
        </p>
      </div>
    </div>
  );
} 