'use client';

import { signIn } from 'next-auth/react';
import Image from 'next/image';

export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">SecurePass</h1>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-600">Sign in to access your passwords</p>
        </div>
        
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
        >
          {/* <Image
            src="/google.svg" // Assumes google.svg is in password-manager/public/
            alt="Google"
            width={24}
            height={24}
            className="w-6 h-6"
          /> */}
          <span className="font-medium">Continue with Google</span>
        </button>
      </div>
    </div>
  );
} 