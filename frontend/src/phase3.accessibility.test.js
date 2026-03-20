import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import WebsiteLayout from './components/website/WebsiteLayout';
import IntegrationsPage from './pages/website/IntegrationsPage';
import RegisterSupabase from './pages/RegisterSupabase';

jest.mock('./context/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({
    signUp: jest.fn().mockResolvedValue({}),
    signInWithOAuth: jest.fn().mockResolvedValue({}),
    hasSupabaseConfig: true,
  }),
}));

describe('Phase 3 accessibility baseline', () => {
  it('keeps skip link first in keyboard order', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WebsiteLayout>
          <button type="button">Primary action</button>
        </WebsiteLayout>
      </MemoryRouter>
    );

    await user.tab();
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveFocus();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('has no critical axe issues on integrations discovery', async () => {
    const { container } = render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no critical axe issues on registration', async () => {
    const { container } = render(
      <MemoryRouter>
        <RegisterSupabase />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
