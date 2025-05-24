'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; // Using outline icons

interface SecureNote {
  id: string;
  title?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  decryptionError?: boolean;
}

const truncateText = (text: string | null | undefined, maxLength: number = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export default function SecureNotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [notes, setNotes] = useState<SecureNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<SecureNote | null>(null);
  const [formData, setFormData] = useState<{ title: string; content: string }>({
    title: '',
    content: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [viewingNoteContent, setViewingNoteContent] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);


  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchNotes();
    }
  }, [status, router]);

  const fetchNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch notes.');
      }
      const data: SecureNote[] = await response.json();
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error("Error fetching notes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (note: SecureNote | null = null) => {
    setError(null);
    if (note) {
      setEditingNote(note);
      setFormData({ title: note.title || '', content: note.content || '' });
    } else {
      setEditingNote(null);
      setFormData({ title: '', content: '' });
    }
    setIsModalOpen(true);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setFormData({ title: '', content: '' });
    setError(null);
  };
  
  const handleViewNote = (note: SecureNote) => {
    if (note.decryptionError) {
        setViewingNoteContent("Error: Could not display content due to a decryption issue.");
    } else {
        setViewingNoteContent(note.content);
    }
    setEditingNote(note); // Keep track of which note is being viewed for title
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.content.trim()) {
        setError("Content cannot be empty.");
        setIsSubmitting(false);
        return;
    }

    const url = editingNote ? `/api/notes/${editingNote.id}` : '/api/notes';
    const method = editingNote ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title: formData.title.trim() || null, // Send null if title is empty
            content: formData.content 
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to ${editingNote ? 'update' : 'create'} note.`);
      }
      
      handleCloseModal();
      fetchNotes(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(`Error ${editingNote ? 'updating' : 'creating'} note:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete note.');
      }
      fetchNotes(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting.');
      console.error("Error deleting note:", err);
      alert(err instanceof Error ? err.message : 'An unknown error occurred while deleting.');
    }
  };
  
  if (status === 'loading' || (status === 'authenticated' && isLoading && notes.length === 0)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (status === 'unauthenticated') {
    // This should ideally be handled by useEffect redirect, but as a fallback:
    return <p className="text-center py-10">Redirecting to sign in...</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Secure Notes</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Note
        </button>
      </div>

      {error && !isModalOpen && <p className="text-red-500 bg-red-100 dark:bg-red-900/30 p-3 rounded-md mb-4">{error}</p>}

      {isLoading && notes.length === 0 && <p>Loading notes...</p>}
      {!isLoading && notes.length === 0 && !error && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-10">
          You don't have any secure notes yet. Click "New Note" to create one.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notes.map(note => (
          <div key={note.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 truncate" title={note.title || 'Untitled Note'}>
              {note.title || <span className="italic">Untitled Note</span>}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 h-12 overflow-hidden">
              {note.decryptionError ? <span className="text-red-500 italic">Error: Content unreadable</span> : truncateText(note.content, 80)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Last updated: {new Date(note.updatedAt).toLocaleDateString()}
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => handleViewNote(note)}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                title="View Note"
              >
                <EyeIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenModal(note)}
                className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-1"
                title="Edit Note"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDelete(note.id)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                title="Delete Note"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {editingNote ? 'Edit Secure Note' : 'Create New Secure Note'}
            </h2>
            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-md mb-3 text-sm">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title (Optional)
                </label>
                <input
                  id="note-title"
                  ref={titleInputRef}
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter note title"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Content
                </label>
                <textarea
                  id="note-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your secure content..."
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>}
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {isViewModalOpen && editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white truncate" title={editingNote.title || 'Untitled Note'}>
              {editingNote.title || <span className="italic">Untitled Note</span>}
            </h2>
            <div className="max-h-[60vh] overflow-y-auto mb-4 pr-2">
                <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                    {viewingNoteContent}
                </pre>
            </div>
             <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Last updated: {new Date(editingNote.updatedAt).toLocaleDateString()} {new Date(editingNote.updatedAt).toLocaleTimeString()}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
