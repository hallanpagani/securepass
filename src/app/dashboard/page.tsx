'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { encrypt } from '@/lib/encryption';
import zxcvbn from 'zxcvbn';
import TwoFactorAuthPrompt from '@/components/TwoFactorAuthPrompt';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import InactivityWarningModal from '@/components/InactivityWarningModal';
import { useDataFetching } from '@/hooks/useDataFetching';
import { useDebounce } from '@/hooks/useDebounce';

interface Tag {
  id: string;
  name: string;
}

interface Password {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  createdAt: string;
  tags?: Tag[];
  isFavorite?: boolean; // Add isFavorite to the Password interface
}

const truncateText = (text: string, maxLength: number = 50) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

const exportToCSV = (passwords: Password[], encrypted: boolean) => {
  // Create CSV header
  const headers = ['Title', 'Username', 'Password', 'URL'];
  
  // Create CSV rows
  const rows = passwords.map(password => [
    password.title,
    password.username,
    encrypted ? encrypt(password.password) : password.password,
    password.url
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `passwords_${encrypted ? 'encrypted' : 'decrypted'}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Define interface for the PasswordCard props
interface PasswordCardProps {
  password: Password;
  onEdit: (password: Password) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentIsFavorite: boolean) => void;
  showPassword: { [key: string]: boolean };
  togglePasswordVisibility: (id: string) => void;
  copyToClipboard: (text: string, id: string, field: string) => Promise<void>;
  copiedField: { id: string; field: string } | null;
  isCopying: { id: string; field: string } | null;
  truncateText: (text: string, maxLength?: number) => string;
}

// Create a memoized password card component to prevent unnecessary re-renders
const PasswordCard = React.memo(({ 
  password, 
  onEdit, 
  onDelete, 
  onToggleFavorite, 
  showPassword, 
  togglePasswordVisibility,
  copyToClipboard,
  copiedField,
  isCopying,
  truncateText
}: PasswordCardProps) => {
  console.log('Rendering PasswordCard for:', password.id, password.title);
  return (
    <div key={password.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words pr-2">{truncateText(password.title)}</h3>
          <button 
            onClick={() => onToggleFavorite(password.id, !!password.isFavorite)}
            title={password.isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="p-1 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 focus:outline-none flex-shrink-0"
          >
            {password.isFavorite ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-500">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.116 3.552.975 5.32c.193 1.052-.932 1.86-1.926 1.304L12 18.354l-4.573 2.482c-.994.556-2.119-.252-1.926-1.304l.974-5.32-4.117-3.552c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.82.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.82-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="grow space-y-2">
          {/* Username section */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Username:</p>
              <button
                onClick={() => copyToClipboard(password.username.trim(), password.id, 'username')}
                disabled={isCopying?.id === password.id && isCopying?.field === 'username'}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                {isCopying?.id === password.id && isCopying?.field === 'username' ? (
                  <div className="animate-spin h-3 w-3 border-b-2 border-blue-500 rounded-full"></div>
                ) : copiedField?.id === password.id && copiedField?.field === 'username' ? (
                  <span className="text-green-500 dark:text-green-400">✓ Copied</span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-gray-800 dark:text-gray-200 text-sm break-all">{truncateText(password.username.trim())}</p>
          </div>
          
          {/* Password section */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password:</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => togglePasswordVisibility(password.id)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
                >
                  {showPassword[password.id] ? 'Hide' : 'Show'}
                </button>
                {showPassword[password.id] && (
                  <button
                    onClick={() => copyToClipboard(password.password, password.id, 'password')}
                    disabled={isCopying?.id === password.id && isCopying?.field === 'password'}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    {isCopying?.id === password.id && isCopying?.field === 'password' ? (
                      <div className="animate-spin h-3 w-3 border-b-2 border-blue-500 rounded-full"></div>
                    ) : copiedField?.id === password.id && copiedField?.field === 'password' ? (
                      <span className="text-green-500 dark:text-green-400">✓ Copied</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <p className="text-gray-800 dark:text-gray-200 text-sm break-all font-mono">
              {showPassword[password.id] ? password.password : '••••••••'}
            </p>
          </div>
          
          {/* URL section - if exists */}
          {password.url && password.url.trim() !== '' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">URL:</p>
                <button
                  onClick={() => copyToClipboard(password.url, password.id, 'url')}
                  disabled={isCopying?.id === password.id && isCopying?.field === 'url'}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  {isCopying?.id === password.id && isCopying?.field === 'url' ? (
                    <div className="animate-spin h-3 w-3 border-b-2 border-blue-500 rounded-full"></div>
                  ) : copiedField?.id === password.id && copiedField?.field === 'url' ? (
                    <span className="text-green-500 dark:text-green-400">✓ Copied</span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-gray-800 dark:text-gray-200 text-sm break-all">{truncateText(password.url)}</p>
            </div>
          )}
        </div>
        
        {/* Display Tags */}
        {password.tags && password.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {password.tags.map(tag => (
              <span key={tag.id} className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                {tag.name}
              </span>
            ))}
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => onEdit(password)}
            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1 border border-blue-500 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/50"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(password.id)}
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1 border border-red-500 dark:border-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

PasswordCard.displayName = 'PasswordCard';

export default function Dashboard() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  
  // Put all initial console logs here at the start of the component
  console.log('Dashboard component rendered. Session status:', status);
  
  // Memoize onError callbacks
  const handlePasswordsError = useCallback((error: Error) => {
    console.log('useDataFetching hook called for passwords.');
    console.error('Error fetching passwords:', error);
    // Handle 401 errors by redirecting to 2FA if needed
    // Ensure all dependencies of this callback are listed: session, status, router
    if (status === 'authenticated' && session?.user?.isTwoFactorEnabled) {
      router.push('/auth/2fa');
    }
  }, [status, session, router]);

  const handleTagsError = useCallback((error: Error) => {
    console.log('useDataFetching hook called for tags.');
    console.error('Error fetching tags:', error);
  }, []); // Empty dependency array if the callback doesn't use external scope variables

  // Use the data fetching hook instead of direct fetch calls
  const { 
    data: passwordsData, 
    isLoading: isLoadingPasswords, 
    refetch: refetchPasswords 
  } = useDataFetching<Password[]>('/api/passwords', {
    onError: handlePasswordsError
  });
  
  const { 
    data: tagsData, 
    refetch: refetchTags,
    isLoading: isLoadingTags // Assuming you might need this
  } = useDataFetching<Tag[]>('/api/tags', {
    onError: handleTagsError
  });
  
  // Local state that uses the fetched data
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  
  // Update local state when API data changes
  useEffect(() => {
    if (passwordsData !== null) {  // Changed from if (passwordsData) to handle empty arrays
      console.log('passwordsData updated. Setting passwords state:', passwordsData ? passwordsData.length : 0, 'items, data:', passwordsData);
      setPasswords(passwordsData || []);
    }
  }, [passwordsData]);
  
  useEffect(() => {
    console.log('tagsData updated. Setting allTags state:', tagsData ? tagsData.length : 0, 'items, data:', tagsData);
    if (tagsData !== null) {  // Changed from if (tagsData) to handle empty arrays
      setAllTags(tagsData || []);
    }
  }, [tagsData]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Debounce search term by 300ms
  const [copiedField, setCopiedField] = useState<{ id: string; field: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<{ id: string; field: string } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] }>({ score: 0, feedback: [] });
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Prioritize updatedSession if available, otherwise fall back to initial session data
  const is2FAPending = session?.user?.is2FAPending ?? false;

  // Password Generation States
  const [showPasswordOptions, setShowPasswordOptions] = useState(false);
  const [passwordGenLength, setPasswordGenLength] = useState(16);
  const [passwordGenUppercase, setPasswordGenUppercase] = useState(true);
  const [passwordGenLowercase, setPasswordGenLowercase] = useState(true);
  const [passwordGenNumbers, setPasswordGenNumbers] = useState(true);
  const [passwordGenSymbols, setPasswordGenSymbols] = useState(true);

  // Password History States
  const [passwordHistory, setPasswordHistory] = useState<any[]>([]); 
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showHistoryPasswords, setShowHistoryPasswords] = useState<{ [key: string]: boolean }>({});

  // Tag States
  const [selectedTagsForFilter, setSelectedTagsForFilter] = useState<string[]>([]); // Array of tag IDs
  const [currentPasswordTagsString, setCurrentPasswordTagsString] = useState(''); // Comma-separated string for input

  // Favorite Filter State
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Tag Filter Dropdown State
  const [isTagFilterDropdownOpen, setIsTagFilterDropdownOpen] = useState(false);

  // URL Copied State
  const [isUrlCopied, setIsUrlCopied] = useState(false);

  // Inactivity Timer State
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  const handleIdle = () => {
    signOut({ callbackUrl: '/auth/signin?error=SessionTimedOut' });
  };

  const handleWarning = () => {
    setShowInactivityWarning(true);
  };
  
  // Timer is active if user is authenticated and not in 2FA pending state
  const isTimerCurrentlyActive = status === 'authenticated' && !is2FAPending;

  const { resetTimers: resetInactivityTimer } = useInactivityTimer({
    onWarning: handleWarning,
    onIdle: handleIdle,
    isTimerActive: isTimerCurrentlyActive, 
  });

  // Add console.log after hook initialization
  console.log('useInactivityTimer hook initialized.');

  const handleStayLoggedIn = () => {
    setShowInactivityWarning(false);
    resetInactivityTimer();
  };

  const handleTitleClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsUrlCopied(true);
      console.log('Page URL copied to clipboard:', window.location.href);
      setTimeout(() => {
        setIsUrlCopied(false);
      }, 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy URL: ', err);
      // You could add a user-facing error message here if desired
    }
  };

  // Use memoized filtering to prevent unnecessary re-renders
  const filteredPasswords = useMemo(() => {
    console.log('Memoizing filtered passwords. searchTerm:', debouncedSearchTerm, 'selectedTags:', selectedTagsForFilter, 'showFavoritesOnly:', showFavoritesOnly, 'passwords state length:', passwords.length);
    // Use the local 'passwords' state which reflects optimistic updates
    const currentPasswords = passwords || [];
    
    if (currentPasswords.length === 0) {
      console.log('No passwords available to filter');
      return [];
    }
    
    return currentPasswords.filter(password => {
      // Filter by search term (debounced)
      const titleMatch = debouncedSearchTerm ? 
        password.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) : true;
      
      // Filter by selected tags
      const tagMatch = selectedTagsForFilter.length === 0 || 
                     (password.tags && password.tags.some(tag => selectedTagsForFilter.includes(tag.id)));
      
      // Filter by favorites
      const favoriteMatch = !showFavoritesOnly || password.isFavorite;
      
      return titleMatch && tagMatch && favoriteMatch;
    });
  }, [passwords, debouncedSearchTerm, selectedTagsForFilter, showFavoritesOnly]);

  const handleToggleFavorite = async (passwordId: string, currentIsFavorite: boolean) => {
    console.log('handleToggleFavorite called for passwordId:', passwordId, 'currentIsFavorite:', currentIsFavorite);
    // Optimistically update UI
    setPasswords(prevPasswords => 
      prevPasswords.map(p => 
        p.id === passwordId ? { ...p, isFavorite: !currentIsFavorite } : p
      )
    );

    console.log('Optimistically updated passwords state for favorite toggle.');
    try {
      const response = await fetch(`/api/passwords/${passwordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentIsFavorite }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        console.error('Error response when toggling favorite:', response.status);
        setPasswords(prevPasswords => 
          prevPasswords.map(p => 
            p.id === passwordId ? { ...p, isFavorite: currentIsFavorite } : p
          )
        );
        const errorData = await response.json();
        alert(`Error updating favorite status: ${errorData.error || 'Unknown error'}`);
      }
      // Optionally, re-fetch all passwords to ensure data consistency,
      // though optimistic update handles immediate UI change.
      // fetchPasswords(); 
    } catch (error) {
      // Revert optimistic update on error
      console.error('Catch block error when toggling favorite:', error);
      setPasswords(prevPasswords => 
        prevPasswords.map(p => 
          p.id === passwordId ? { ...p, isFavorite: currentIsFavorite } : p
        )
      );
      alert(`Error updating favorite status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error toggling favorite:', error);
    }
  };
  
  // Replace the previous fetchPasswords and fetchAllTags functions
  // with wrappers around our refetch functions
  const fetchPasswords = useCallback(async () => {
    console.log('fetchPasswords called.');
    if (isLoadingPasswords) return; // Don't fetch if already loading
    await refetchPasswords(); // This already forces a refresh
  }, [isLoadingPasswords, refetchPasswords]);
  
  const fetchAllTags = useCallback(async () => {
    console.log('fetchAllTags called.');
    if (isLoadingPasswords) return; // Don't fetch if passwords are loading
    await refetchTags();
  }, [isLoadingPasswords, refetchTags]);

  // Authentication redirect effect
  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('Authentication status: unauthenticated. Redirecting to signin.');
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.id) {
      // Check if user needs to complete 2FA
      if (session.user.isTwoFactorEnabled && session.user.is2FAPending) {
        // Redirect to 2FA page
        router.push('/auth/2fa');
      } else {
        console.log('Authentication status: authenticated and 2FA not pending. Checking if data needs fetching.');
        // Only fetch data when fully authenticated and not already loading
        if (!isLoadingPasswords && !passwordsData) {
          console.log('passwordsData not available, fetching passwords...');
          fetchPasswords();
        }
        
        if (!tagsData) {
          console.log('tagsData not available, fetching tags...');
          fetchAllTags();
        }
      }
    }
  }, [status, router, session?.user?.id, session?.user?.isTwoFactorEnabled, 
      session?.user?.is2FAPending, isLoadingPasswords, passwordsData, 
      tagsData, fetchPasswords, fetchAllTags]);
  console.log('Dashboard useEffect dependencies updated.');

  // Add a timeout to prevent getting stuck in loading state
  useEffect(() => {
    if (isLoadingPasswords) {
      const timeoutId = setTimeout(() => {
        console.log('Loading timeout reached, forcing UI update');
        // Force display content even if loading is still true
        setPasswords([]); // Set empty array if data loading takes too long
      }, 5000); // 5 seconds timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoadingPasswords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const url = editingPassword 
        ? `/api/passwords/${editingPassword.id}`
        : '/api/passwords';
      
      const method = editingPassword ? 'PUT' : 'POST';
      
      const trimmedFormData = {
        title: formData.title.trim(),
        username: formData.username.trim(),
        password: formData.password.trim(),
        url: formData.url.trim(),
        tags: currentPasswordTagsString.split(',').map(tag => tag.trim()).filter(tag => tag), // Add tags
      };

      // Validate max length
      const maxLength = 500;
      if (trimmedFormData.title.length > maxLength) {
        console.warn('Validation failed: Title exceeds max length.');
        alert(`Title exceeds maximum length of ${maxLength} characters`);
        return;
      }
      if (trimmedFormData.username.length > maxLength) {
        console.warn('Validation failed: Username exceeds max length.');
        alert(`Username exceeds maximum length of ${maxLength} characters`);
        return;
      }
      if (trimmedFormData.password.length > maxLength) {
        console.warn('Validation failed: Password exceeds max length.');
        alert(`Password exceeds maximum length of ${maxLength} characters`);
        return;
      }
      if (trimmedFormData.url.length > maxLength) {
        alert(`URL exceeds maximum length of ${maxLength} characters`);
        console.warn('Validation failed: URL exceeds max length.');
        return;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trimmedFormData),
      });

      if (response.ok) {
        console.log('Password saved successfully.');
        const newPasswordData = await response.json();
        
        // Update local state immediately for better UX
        if (editingPassword) {
          // For updates, replace the existing password in the local state
          setPasswords(prevPasswords => 
            prevPasswords.map(p => p.id === editingPassword.id ? newPasswordData : p)
          );
        } else {
          // For new passwords, add to the beginning of the list
          setPasswords(prevPasswords => [newPasswordData, ...prevPasswords]);
        }
        
        setIsModalOpen(false);
        setEditingPassword(null);
        setFormData({ title: '', username: '', password: '', url: '' }); // Reset form
        setCurrentPasswordTagsString(''); // Reset tags string
        fetchPasswords(); // Refresh password list (which now includes tags)
        fetchAllTags(); // Refresh all tags in case new ones were created
      } else {
        console.error('Error saving password: Response not OK', response);
        const errorData = await response.json();
        alert(`Error saving password: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving password:', error);
      alert('An unexpected error occurred while saving the password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this password?')) {
      console.log('Deleting password with id:', id);
      try {
        setIsDeleting(id);
        const response = await fetch(`/api/passwords/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          // Update UI immediately
          setPasswords(prevPasswords => prevPasswords.filter(p => p.id !== id));
          console.log('Password deleted successfully, removing from UI.');
          fetchPasswords(); // Still fetch in background to ensure sync with server
        } else {
          console.error('Error deleting password: Response not OK', response);
          const errorData = await response.json();
          alert(`Error deleting password: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        console.error('Error deleting password:', error);
        alert('An unexpected error occurred while deleting the password.');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleEdit = (password: Password) => {
    console.log('Opening modal for editing password:', password.id, password.title);
    setEditingPassword(password);
    setFormData({
      title: password.title.trim(),
      username: password.username.trim(),
      password: password.password.trim(), 
      url: password.url.trim(),
    });
    setCurrentPasswordTagsString(password.tags?.map(tag => tag.name).join(', ') || '');
    // Reset and fetch history for the selected password
    setPasswordHistory([]);
    setHistoryError(null);
    setShowHistoryPasswords({});
    if (password.id) { // Only fetch if it's an existing password
      fetchPasswordHistory(password.id);
    }
    setIsModalOpen(true);
  };

  const fetchPasswordHistory = async (passwordId: string) => {
    console.log('Fetching password history for ID:', passwordId);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/passwords/${passwordId}/history`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch password history.');
      }
      const historyData = await response.json();
      console.log('Fetched password history:', historyData.length, 'entries');
      setPasswordHistory(historyData);
    } catch (error) {
      console.error('Error fetching password history:', error);
      setHistoryError(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRevertPassword = async (passwordEntryId: string, historyId: string) => {
    console.log('Attempting to revert password entry:', passwordEntryId, 'to history ID:', historyId);
    if (!confirm('Are you sure you want to revert to this password version? The current password will be moved to history.')) {
      return;
    }
    setIsSubmitting(true); // Use main form submitting state or a dedicated one
    try {
      console.log('Sending POST request to revert password.');
      const response = await fetch(`/api/passwords/${passwordEntryId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to revert password.');
      }      console.log('Password reverted successfully. Response data:', data);
      alert('Password reverted successfully!');
      
      // Update the form with the reverted password (data.revertedPassword.password is encrypted)
      // We need the decrypted version if the main form expects it.
      // For simplicity, let's assume the API returns the decrypted password or we re-fetch.
      // For now, let's just update from history if available, or refetch.
      const revertedHistoryEntry = passwordHistory.find(h => h.id === historyId);
      if (revertedHistoryEntry && revertedHistoryEntry.password && !revertedHistoryEntry.decryptionError) {
        console.log('Updating form with reverted password from history.');
        setFormData(prev => ({ ...prev, password: revertedHistoryEntry.password }));
        handlePasswordChange({ target: { value: revertedHistoryEntry.password } }); // Update strength meter
      } else {
         // If not available or decrypted, best to re-fetch the main password entry to get the new current password.
         // This requires fetching the specific password item again.
         // Or, the API could return the updated main password object with decrypted password.
         // For now, we'll rely on the user seeing the change after modal closes and list refreshes.
      }

      fetchPasswords(); // Refresh the main list of passwords
      console.log('Refetching main password list.');
      fetchPasswordHistory(passwordEntryId); // Refresh the history for the current item

    } catch (error) {
      console.error('Error reverting password:', error);
      alert(error instanceof Error ? error.message : 'An unknown error occurred while reverting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleShowHistoryPassword = (historyId: string) => {
    console.log('Toggling password visibility for history entry:', historyId);
    setShowHistoryPasswords(prev => ({ ...prev, [historyId]: !prev[historyId] }));
  };

  const togglePasswordVisibility = (id: string) => {
    console.log('Toggling password visibility for main password ID:', id);
    setShowPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = async (text: string, id: string, field: string) => {
    console.log('Attempting to copy', field, 'for ID:', id);
    try {
      setIsCopying({ id, field });
      await navigator.clipboard.writeText(text);
      setCopiedField({ id, field });
      setTimeout(() => {
        setCopiedField(null);
        console.log('Copy state reset after timeout.');
        setIsCopying(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setIsCopying(null);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('handleImportCSV called. File:', file?.name);
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));
      const headers = rows[0];
      const data = rows.slice(1);

      // Validate headers
      const requiredHeaders = ['Title', 'Username', 'Password', 'URL'];
      const hasValidHeaders = requiredHeaders.every(header => headers.includes(header));
      console.log('CSV headers:', headers, 'Valid headers found:', hasValidHeaders);
      if (!hasValidHeaders) {
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        throw new Error(`Invalid CSV format. Missing required headers: ${missingHeaders.join(', ')}`);
      }

      let successCount = 0;
      let errorCount = 0;
      let errorMessages: string[] = [];

      // Process each row
      for (let index = 0; index < data.length; index++) {
        console.log('Processing CSV row:', index + 2);
        const row = data[index];
        if (row.length !== headers.length) {
          errorCount++;
          errorMessages.push(`Row ${index + 2}: Invalid number of columns. Expected ${headers.length}, got ${row.length}`);
          continue;
        }

        const passwordData = {
          title: row[headers.indexOf('Title')].trim(),
          username: row[headers.indexOf('Username')].trim(),
          password: row[headers.indexOf('Password')].trim(),
          url: row[headers.indexOf('URL')].trim(),
        };

        // Validate required fields
        if (!passwordData.title || !passwordData.username || !passwordData.password) {
          console.warn('Row validation failed: Missing required fields in row', index + 2);
          errorCount++;
          errorMessages.push(`Row ${index + 2}: Missing required fields (Title, Username, or Password)`);
          continue;
        }

        // Validate max length
        const maxLength = 500;
        if (passwordData.title.length > maxLength) {          errorCount++;
          errorMessages.push(`Row ${index + 2}: Title exceeds maximum length of ${maxLength} characters`);
          continue;
        }
        if (passwordData.username.length > maxLength) {
          console.warn('Row validation failed: Username exceeds max length in row', index + 2);
          errorCount++;
          errorMessages.push(`Row ${index + 2}: Username exceeds maximum length of ${maxLength} characters`);
          continue;
        }
        if (passwordData.password.length > maxLength) {
          console.warn('Row validation failed: Password exceeds max length in row', index + 2);
          errorCount++;
          errorMessages.push(`Row ${index + 2}: Password exceeds maximum length of ${maxLength} characters`);
          continue;
        }
        if (passwordData.url.length > maxLength) {
          console.warn('Row validation failed: URL exceeds max length in row', index + 2);
          errorCount++;
          errorMessages.push(`Row ${index + 2}: URL exceeds maximum length of ${maxLength} characters`);
          continue;
        }

        try {
          // Add password to database
          const response = await fetch('/api/passwords', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(passwordData),
          });

          if (!response.ok) {
            console.warn('API response not OK for row', index + 2, 'Status:', response.status);
            const errorData = await response.json();
            errorCount++;
            errorMessages.push(`Row ${index + 2}: ${errorData.error || response.statusText}`);
          } else {
            successCount++;
          }
        } catch (error) {
          errorCount++;
          console.error('Error processing row', index + 2, ':', error);
          errorMessages.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh the password list
      await fetchPasswords();

      // Show results
      if (errorCount > 0) {
        alert(`Import completed with ${successCount} successful imports and ${errorCount} errors.\n\nErrors:\n${errorMessages.join('\n')}`);
      } else {
        alert(`Successfully imported ${successCount} passwords!`);
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert(error instanceof Error ? error.message : 'Error importing CSV');
    } finally {
      setIsImporting(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleOpenModal = () => {
    console.log('Opening modal for adding new password.');
    setEditingPassword(null);
    setFormData({ title: '', username: '', password: '', url: '' });
    setCurrentPasswordTagsString(''); // Reset tags for new password
    setPasswordStrength({ score: 0, feedback: [] }); 
    setShowPasswordOptions(false); 
    setPasswordGenLength(16);
    setPasswordGenUppercase(true);
    setPasswordGenLowercase(true);
    setPasswordGenNumbers(true);
    setPasswordGenSymbols(true);
    setIsModalOpen(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => {
    console.log('Password input changed. Evaluating strength.');
    const newPassword = e.target.value;
    setFormData({ ...formData, password: newPassword });
    if (newPassword) {
      const strength = zxcvbn(newPassword);
      setPasswordStrength({ score: strength.score, feedback: strength.feedback.suggestions || [] });
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  };

  const generatePassword = () => {
    console.log('Generating password with length:', passwordGenLength, 'Uppercase:', passwordGenUppercase, 'Lowercase:', passwordGenLowercase, 'Numbers:', passwordGenNumbers, 'Symbols:', passwordGenSymbols);
    const lowerCharset = "abcdefghijklmnopqrstuvwxyz";
    const upperCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numberCharset = "0123456789";
    const symbolCharset = "!@#$%^&*()_+-=[]{};':\",./<>?";
    
    let charset = "";
    let guaranteedChars = "";

    if (passwordGenLowercase) {
      charset += lowerCharset;
      guaranteedChars += lowerCharset[Math.floor(Math.random() * lowerCharset.length)];
    }
    if (passwordGenUppercase) {
      charset += upperCharset;
      guaranteedChars += upperCharset[Math.floor(Math.random() * upperCharset.length)];
    }
    if (passwordGenNumbers) {
      charset += numberCharset;
      guaranteedChars += numberCharset[Math.floor(Math.random() * numberCharset.length)];
    }
    if (passwordGenSymbols) {
      charset += symbolCharset;
      guaranteedChars += symbolCharset[Math.floor(Math.random() * symbolCharset.length)];
    }

    if (charset === "") {
      console.warn('Password generation failed: No character types selected.');
      alert("Please select at least one character type for password generation.");
      return;
    }
    
    // Ensure length is sufficient for guaranteed characters
    const currentLength = parseInt(String(passwordGenLength), 10);
    if (currentLength < guaranteedChars.length) {
        console.warn('Password generation failed: Length too short for selected types.');
        alert(`Password length must be at least ${guaranteedChars.length} to include all selected character types.`);
        setPasswordGenLength(guaranteedChars.length); // Adjust length to minimum possible
        return; // User needs to re-evaluate or re-click generate
    }


    let generatedPassword = guaranteedChars;
    for (let i = guaranteedChars.length; i < currentLength; i++) {
      generatedPassword += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password to ensure guaranteed characters are not always at the beginning
    generatedPassword = generatedPassword.split('').sort(() => 0.5 - Math.random()).join('');
    console.log('Generated password:', generatedPassword.slice(0, 5) + '...'); // Log partially
    
    setFormData({ ...formData, password: generatedPassword });
    // Simulate change event for password strength indicator
    handlePasswordChange({ target: { value: generatedPassword } });
    setShowPasswordOptions(false); // Optionally hide options after generation
    console.log('Generated password applied to form.');
  };

  console.log('Rendering Dashboard component.');

  // Only show loading state when status is loading or when we're actively fetching but don't have data yet
  if (status === 'loading' || (isLoadingPasswords && passwordsData === null)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <div className="ml-3 text-gray-700 dark:text-gray-300">Loading passwords...</div>
      </div>
    );
  }

  // If authenticated and 2FA is pending, show the 2FA prompt
  if (status === 'authenticated' && is2FAPending) {
    return <TwoFactorAuthPrompt />;
  }
  
  // If authenticated and 2FA is NOT pending, show the main dashboard
  if (status === 'authenticated' && !is2FAPending) {
    return (
      <> {/* Use Fragment to allow multiple top-level elements including the modal */}
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-end gap-2 flex-wrap"> {/* Added flex-wrap */}
              <label className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2 cursor-pointer">
                <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
              disabled={isImporting}
            />
            {isImporting ? (
              <>
                <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                Importing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import CSV
              </>
            )}
          </label>
          <button
            onClick={() => {
              exportToCSV(filteredPasswords, false);
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center justify-center gap-2"
            disabled={isExporting || filteredPasswords.length === 0}
          >
            {isExporting ? (
              <>
                <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                Exporting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </>
            )}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          {/* Left Side: Title and Count */}
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <h1 
              onClick={handleTitleClick}
              className="text-3xl font-bold text-gray-900 dark:text-white cursor-pointer transition-all duration-150 ease-in-out hover:text-blue-600 dark:hover:text-blue-400"
              title="Click to copy page URL to share"
            >
              {isUrlCopied ? "URL Copied!" : "SecurePass"}
            </h1>
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {filteredPasswords.length} {filteredPasswords.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Right Side: Controls - flex-wrap for responsiveness */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-auto md:w-56 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />

            {/* Improved Tag Filter Dropdown */}
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setIsTagFilterDropdownOpen(!isTagFilterDropdownOpen)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between"
              >
                <span className="truncate max-w-[150px]">
                  {selectedTagsForFilter.length > 0 
                    ? `Tags: ${selectedTagsForFilter.map(tagId => allTags.find(t => t.id === tagId)?.name).filter(Boolean).join(', ')}` 
                    : "Filter by Tags"}
                </span>
                <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${isTagFilterDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              {isTagFilterDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {allTags.length > 0 ? (
                    allTags.map(tag => (
                      <label key={tag.id} className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTagsForFilter.includes(tag.id)}
                          onChange={() => {
                            setSelectedTagsForFilter(prev => 
                              prev.includes(tag.id) 
                                ? prev.filter(id => id !== tag.id) 
                                : [...prev, tag.id]
                            );
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No tags available</p>
                  )}
                  {allTags.length > 0 && selectedTagsForFilter.length > 0 && (
                     <button 
                        onClick={() => {setSelectedTagsForFilter([]); setIsTagFilterDropdownOpen(false);}} 
                        className="w-full text-left px-4 py-2 text-xs text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-700 border-t border-gray-200 dark:border-gray-700"
                      >
                        Clear All Filters
                      </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Favorites Filter Toggle */}
            <div className="flex items-center space-x-2 w-full sm:w-auto sm:justify-start">
              <label htmlFor="favorites-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Favorites Only
              </label>
              <button
                type="button"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`${showFavoritesOnly ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
                role="switch"
                aria-checked={showFavoritesOnly}
              >
                <span
                  aria-hidden="true"
                  className={`${showFavoritesOnly ? 'translate-x-5' : 'translate-x-0'}
                   inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
            <button
              onClick={handleOpenModal}
              className="flex-1 sm:flex-none bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add New Password
            </button>
          </div>
        </div>
      </div>

      {/* Password List Section */}
      {isLoadingPasswords && !passwordsData ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredPasswords.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {passwordsData && passwordsData.length > 0 
              ? "No passwords match your filters. Try adjusting your search or filters."
              : "You don't have any passwords yet. Click 'Add New Password' to get started."}
          </p>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Password
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredPasswords.map((password) => (
            <PasswordCard
              key={password.id}
              password={password}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              showPassword={showPassword}
              togglePasswordVisibility={togglePasswordVisibility}
              copyToClipboard={copyToClipboard}
              copiedField={copiedField}
              isCopying={isCopying}
              truncateText={truncateText}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"> {/* Ensure z-index is appropriate */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingPassword ? 'Edit Password' : 'Add New Password'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value.trim() })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handlePasswordChange}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    maxLength={500}
                    disabled={isSubmitting}
                    autoComplete={editingPassword ? "current-password" : "new-password"}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 space-x-0.5"> {/* Adjusted padding and spacing */}
                    <button
                      type="button"
                      onClick={() => setShowPasswordOptions(!showPasswordOptions)}
                      title="Generate Password"
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                    <button
                      type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    {showFormPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                    </button>
                  </div>
                </div>

                {showPasswordOptions && (
                  <div className="p-3 my-2 border rounded-md bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label htmlFor="gen-length" className="block text-xs font-medium text-gray-700 dark:text-gray-300">Length: {passwordGenLength}</label>
                        <input 
                          type="range" 
                          id="gen-length" 
                          min="8" 
                          max="64" 
                          value={passwordGenLength} 
                          onChange={(e) => setPasswordGenLength(Number(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                        />
                      </div>
                      <div className="flex items-center">
                        <input 
                          id="gen-uppercase" 
                          type="checkbox" 
                          checked={passwordGenUppercase} 
                          onChange={(e) => setPasswordGenUppercase(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="gen-uppercase" className="ml-2 text-xs text-gray-700 dark:text-gray-300">Uppercase (A-Z)</label>
                      </div>
                      <div className="flex items-center">
                        <input 
                          id="gen-lowercase" 
                          type="checkbox" 
                          checked={passwordGenLowercase} 
                          onChange={(e) => setPasswordGenLowercase(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="gen-lowercase" className="ml-2 text-xs text-gray-700 dark:text-gray-300">Lowercase (a-z)</label>
                      </div>
                      <div className="flex items-center">
                        <input 
                          id="gen-numbers" 
                          type="checkbox" 
                          checked={passwordGenNumbers} 
                          onChange={(e) => setPasswordGenNumbers(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="gen-numbers" className="ml-2 text-xs text-gray-700 dark:text-gray-300">Numbers (0-9)</label>
                      </div>
                      <div className="flex items-center">
                        <input 
                          id="gen-symbols" 
                          type="checkbox" 
                          checked={passwordGenSymbols} 
                          onChange={(e) => setPasswordGenSymbols(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="gen-symbols" className="ml-2 text-xs text-gray-700 dark:text-gray-300">Symbols (!@#...)</label>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-800"
                    >
                      Generate & Apply
                    </button>
                  </div>
                )}

                {formData.password && (
                  <div className="mt-2">
                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-600 rounded">
                      <div
                        className={`h-2 rounded ${passwordStrength.score === 0 ? 'bg-red-500' : passwordStrength.score === 1 ? 'bg-red-500' : passwordStrength.score === 2 ? 'bg-yellow-500' : passwordStrength.score === 3 ? 'bg-green-500' : 'bg-green-500'}`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      ></div>
                    </div>
                    <p className={`text-xs mt-1 ${passwordStrength.score <= 1 ? 'text-red-500' : passwordStrength.score === 2 ? 'text-yellow-500' : 'text-green-500'}`}>
                      Strength: {passwordStrength.score === 0 ? 'Very Weak' : passwordStrength.score === 1 ? 'Weak' : passwordStrength.score === 2 ? 'Medium' : passwordStrength.score === 3 ? 'Strong' : 'Very Strong'}
                    </p>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc pl-5 mt-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Password History Section - Only in Edit Mode */}
              {editingPassword && (
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  <h3 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">Password History</h3>
                  {historyLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading history...</p>}
                  {historyError && <p className="text-sm text-red-500 dark:text-red-400">{historyError}</p>}
                  {!historyLoading && !historyError && passwordHistory.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No previous passwords found.</p>
                  )}
                  {!historyLoading && !historyError && passwordHistory.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {passwordHistory.map(entry => (
                        <div key={entry.id} className="p-2 border dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-xs">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-mono text-gray-700 dark:text-gray-300">
                                {showHistoryPasswords[entry.id] ? (entry.decryptionError ? <span className="text-red-500 italic">Decryption Error</span> : entry.password) : '••••••••'}
                              </span>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">
                                Saved: {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="space-x-1">
                               <button
                                type="button"
                                onClick={() => toggleShowHistoryPassword(entry.id)}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                                title={showHistoryPasswords[entry.id] ? "Hide" : "Show"}
                                disabled={entry.decryptionError}
                              >
                                {showHistoryPasswords[entry.id] && !entry.decryptionError ? (
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.524M4.222 4.222L19.778 19.778" /></svg>
                                ) : (
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevertPassword(editingPassword.id, entry.id)}
                                className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-1 disabled:opacity-50"
                                title="Revert to this version"
                                disabled={isSubmitting || entry.decryptionError}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter URL"
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>
              {/* Tags Input */}
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma-separated)</label>
                <input
                  type="text"
                  id="tags"
                  value={currentPasswordTagsString}
                  onChange={(e) => setCurrentPasswordTagsString(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., work, personal, social"
                  disabled={isSubmitting}
                />
                 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Existing tags: {allTags.map(t => t.name).join(', ') || 'None'}
                  </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                      {editingPassword ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    editingPassword ? 'Update' : 'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        </div>
        <InactivityWarningModal
          isOpen={showInactivityWarning}
          onClose={() => {
            setShowInactivityWarning(false);
            handleIdle(); // User chose to logout or timer ran out in modal
          }}
          onStayLoggedIn={handleStayLoggedIn}
        />
      </>
    );
  }

  // Fallback or if status is neither loading, authenticated, nor unauthenticated (should not happen)
  // Or, handle unauthenticated case explicitly here if not relying solely on useEffect for redirect
  // For example, if useEffect hasn't run yet or if server-side rendering is involved differently.
  // However, with 'use client', useEffect is standard for this.
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Redirecting to sign-in...</p>
    </div>
  );
}

