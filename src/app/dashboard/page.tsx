'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Password {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  createdAt: string;
}

const truncateText = (text: string, maxLength: number = 50) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedField, setCopiedField] = useState<{ id: string; field: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const filteredPasswords = passwords.filter(password => 
    password.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') { // Added explicit check for authenticated
      fetchPasswords();
    }
  }, [status, router]); // Added router to dependency array

  const fetchPasswords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/passwords');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setPasswords(data);
        } else {
          console.error('Error fetching passwords: Data is not an array', data);
          setPasswords([]); 
        }
      } else {
        console.error('Error fetching passwords: Response not OK', response);
        setPasswords([]); 
      }
    } catch (error) {
      console.error('Error fetching passwords:', error);
      setPasswords([]); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const url = editingPassword 
        ? `/api/passwords/${editingPassword.id}`
        : '/api/passwords';
      
      const method = editingPassword ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingPassword(null);
        setFormData({ title: '', username: '', password: '', url: '' });
        fetchPasswords();
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
      try {
        setIsDeleting(id);
        const response = await fetch(`/api/passwords/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchPasswords();
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
    setEditingPassword(password);
    setFormData({
      title: password.title,
      username: password.username,
      password: password.password, // Note: For actual edit, you might not want to prefill this for security.
      url: password.url,
    });
    setIsModalOpen(true);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = async (text: string, id: string, field: string) => {
    try {
      setIsCopying({ id, field });
      await navigator.clipboard.writeText(text);
      setCopiedField({ id, field });
      setTimeout(() => {
        setCopiedField(null);
        setIsCopying(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setIsCopying(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-end">
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">SecurePass</h1>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
              {filteredPasswords.length} {filteredPasswords.length === 1 ? 'password' : 'passwords'}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                setEditingPassword(null);
                setFormData({ title: '', username: '', password: '', url: '' });
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add New Password
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : passwords.length === 0 && status === 'authenticated' ? (
        <p>No passwords found. Add one!</p>
      ) : (
        <div className="grid gap-4">
          {filteredPasswords.map((password) => (
            <div key={password.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="w-full">
                  <h3 className="text-lg font-semibold">{truncateText(password.title)}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-800 dark:text-gray-200">Username: {password.username}</p>
                    <button
                      onClick={() => copyToClipboard(password.username, password.id, 'username')}
                      disabled={isCopying?.id === password.id && isCopying?.field === 'username'}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      {isCopying?.id === password.id && isCopying?.field === 'username' ? (
                        <div className="animate-spin h-4 w-4 border-b-2 border-blue-500 rounded-full"></div>
                      ) : copiedField?.id === password.id && copiedField?.field === 'username' ? (
                        <span className="text-green-500">✓ Copied!</span>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-800 dark:text-gray-200">Password: </p>
                    <span className="text-gray-800 dark:text-gray-200 break-all">
                      {showPassword[password.id] ? password.password : '••••••••'}
                    </span>
                    <button
                      onClick={() => togglePasswordVisibility(password.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showPassword[password.id] ? 'Hide' : 'Show'}
                    </button>
                    {showPassword[password.id] && (
                      <button
                        onClick={() => copyToClipboard(password.password, password.id, 'password')}
                        disabled={isCopying?.id === password.id && isCopying?.field === 'password'}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        {isCopying?.id === password.id && isCopying?.field === 'password' ? (
                          <div className="animate-spin h-4 w-4 border-b-2 border-blue-500 rounded-full"></div>
                        ) : copiedField?.id === password.id && copiedField?.field === 'password' ? (
                          <span className="text-green-500">✓ Copied!</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {password.url && password.url.trim() !== '' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-800 dark:text-gray-200">URL: {truncateText(password.url)}</p>
                      <button
                        onClick={() => copyToClipboard(password.url, password.id, 'url')}
                        disabled={isCopying?.id === password.id && isCopying?.field === 'url'}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        {isCopying?.id === password.id && isCopying?.field === 'url' ? (
                          <div className="animate-spin h-4 w-4 border-b-2 border-blue-500 rounded-full"></div>
                        ) : copiedField?.id === password.id && copiedField?.field === 'url' ? (
                          <span className="text-green-500">✓ Copied!</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 self-end sm:self-start">
                  <button
                    onClick={() => handleEdit(password)}
                    className="text-blue-500 hover:text-blue-700 px-3 py-1 border border-blue-500 rounded hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(password.id)}
                    disabled={isDeleting === password.id}
                    className="text-red-500 hover:text-red-700 px-3 py-1 border border-red-500 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDeleting === password.id ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-b-2 border-red-500 rounded-full"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingPassword ? 'Edit Password' : 'Add New Password'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                    required
                    disabled={isSubmitting}
                    autoComplete={editingPassword ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
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
              <div>
                <label className="block text-sm font-medium text-gray-700">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter URL"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
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
  );
} 