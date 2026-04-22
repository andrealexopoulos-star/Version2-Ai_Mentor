import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignalActionsMenu from '../components/SignalActionsMenu';

// Mock apiClient so we can assert the POST payloads without hitting network.
jest.mock('../lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '../lib/api';

describe('SignalActionsMenu — Sprint B #17 Phase 2', () => {
  beforeEach(() => {
    apiClient.post.mockReset();
  });

  it('renders null when eventId is missing', () => {
    const { container } = render(<SignalActionsMenu eventId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the ⋯ button for a given eventId', () => {
    render(<SignalActionsMenu eventId="evt-1" />);
    expect(screen.getByLabelText(/signal actions/i)).toBeInTheDocument();
    // Popover not open yet
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens popover with snooze + feedback sections on button click', () => {
    render(<SignalActionsMenu eventId="evt-1" />);
    fireEvent.click(screen.getByLabelText(/signal actions/i));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Snooze 24 hours')).toBeInTheDocument();
    expect(screen.getByText('Snooze 7 days')).toBeInTheDocument();
    expect(screen.getByText('Not relevant')).toBeInTheDocument();
    expect(screen.getByText('Already done')).toBeInTheDocument();
    expect(screen.getByText('Report as incorrect')).toBeInTheDocument();
  });

  it('POSTs to /signals/{id}/snooze with a future ISO timestamp when "Snooze 24 hours" clicked', async () => {
    apiClient.post.mockResolvedValue({ data: { ok: true } });
    const onAfter = jest.fn();
    render(<SignalActionsMenu eventId="evt-1" onAfterAction={onAfter} />);
    fireEvent.click(screen.getByLabelText(/signal actions/i));
    fireEvent.click(screen.getByText('Snooze 24 hours'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());

    const [path, body] = apiClient.post.mock.calls[0];
    expect(path).toBe('/signals/evt-1/snooze');
    expect(body.source_surface).toBe('advisor');
    // Verify `until` is roughly 24h in the future
    const deltaHours = (new Date(body.until) - new Date()) / 3_600_000;
    expect(deltaHours).toBeGreaterThan(23);
    expect(deltaHours).toBeLessThan(25);

    await waitFor(() => expect(onAfter).toHaveBeenCalledWith('snooze_24h'));
  });

  it('POSTs correct feedback_key when "Already done" clicked', async () => {
    apiClient.post.mockResolvedValue({ data: { ok: true } });
    const onAfter = jest.fn();
    render(<SignalActionsMenu eventId="evt-1" onAfterAction={onAfter} />);
    fireEvent.click(screen.getByLabelText(/signal actions/i));
    fireEvent.click(screen.getByText('Already done'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(apiClient.post).toHaveBeenCalledWith(
      '/signals/evt-1/feedback',
      expect.objectContaining({ feedback_key: 'already_done', source_surface: 'advisor' })
    );
    await waitFor(() => expect(onAfter).toHaveBeenCalledWith('already_done'));
  });

  it('covers all three feedback keys with correct values', async () => {
    apiClient.post.mockResolvedValue({ data: { ok: true } });
    const mapping = {
      'Not relevant': 'not_relevant',
      'Already done': 'already_done',
      'Report as incorrect': 'incorrect',
    };
    for (const [label, key] of Object.entries(mapping)) {
      apiClient.post.mockClear();
      const { unmount } = render(<SignalActionsMenu eventId={`evt-${key}`} />);
      fireEvent.click(screen.getByLabelText(/signal actions/i));
      fireEvent.click(screen.getByText(label));
      await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
      expect(apiClient.post).toHaveBeenCalledWith(
        `/signals/evt-${key}/feedback`,
        expect.objectContaining({ feedback_key: key })
      );
      unmount();
    }
  });

  it('shows error message and keeps row visible when the API call fails', async () => {
    apiClient.post.mockRejectedValue(new Error('boom'));
    const onAfter = jest.fn();
    render(<SignalActionsMenu eventId="evt-1" onAfterAction={onAfter} />);
    fireEvent.click(screen.getByLabelText(/signal actions/i));
    fireEvent.click(screen.getByText('Not relevant'));
    await waitFor(() => expect(screen.getByText(/Couldn.t submit/i)).toBeInTheDocument());
    // onAfterAction NOT called — row must remain visible
    expect(onAfter).not.toHaveBeenCalled();
  });

  it('closes popover on outside click', () => {
    render(
      <div>
        <SignalActionsMenu eventId="evt-1" />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.click(screen.getByLabelText(/signal actions/i));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
