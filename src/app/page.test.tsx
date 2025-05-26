import { render, screen } from '@testing-library/react';
import HomePage from './page'; // Adjust path if necessary

// Mock next/font/google
jest.mock('next/font/google', () => ({
    Inter: () => ({ className: 'inter' }),
    Lusitana: () => ({ className: 'lusitana' }),
    // Add any other fonts used by your application if needed
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    // Add other router methods if needed by the component
  }),
  redirect: jest.fn(), // Mock redirect
}));

// Mock next-auth/next
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue(null), // Default mock for no session
}));


describe('HomePage', () => {
  it('renders the main heading', async () => {
    // Since HomePage is an async component, we need to handle the promise
    const HomePageResolved = await HomePage();
    render(HomePageResolved);
    
    // Check for the main heading text
    expect(screen.getByText('Secure Password Management Made Simple')).toBeInTheDocument();
    
    // Also check by role and level for robustness
    expect(screen.getByRole('heading', { level: 1, name: 'Secure Password Management Made Simple' })).toBeInTheDocument();
  });

  it('renders the sign-in button', async () => {
    const HomePageResolved = await HomePage();
    render(HomePageResolved);
    expect(screen.getByRole('link', { name: /Sign in with Google/i })).toBeInTheDocument();
  });
});
