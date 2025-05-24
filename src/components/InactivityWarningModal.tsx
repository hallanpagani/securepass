'use client';

import React, { useState, useEffect, useCallback } from 'react';

const WARNING_DIALOG_TIMEOUT_MS = 2 * 60 * 1000; // Should match the one in the hook (or be passed as prop)

interface InactivityWarningModalProps {
  isOpen: boolean;
  onClose: () => void; // Called when "Logout Now" or automatically closed after countdown
  onStayLoggedIn: () => void;
}

export default function InactivityWarningModal({ isOpen, onClose, onStayLoggedIn }: InactivityWarningModalProps) {
  const [countdown, setCountdown] = useState(Math.ceil(WARNING_DIALOG_TIMEOUT_MS / 1000));

  useEffect(() => {
    if (!isOpen) {
      setCountdown(Math.ceil(WARNING_DIALOG_TIMEOUT_MS / 1000)); // Reset countdown when modal closes
      return;
    }

    if (countdown <= 0) {
      onClose(); // Trigger logout if countdown reaches zero
      return;
    }

    const timerId = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [isOpen, countdown, onClose]);

  const handleStayLoggedIn = () => {
    onStayLoggedIn();
  };

  const handleLogoutNow = () => {
    onClose(); // This will trigger the signOut in the main component
  };

  if (!isOpen) {
    return null;
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Are you still there?</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-2">
          For your security, you will be logged out automatically due to inactivity.
        </p>
        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-6 text-center">
          Time remaining: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleLogoutNow}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Logout Now
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
