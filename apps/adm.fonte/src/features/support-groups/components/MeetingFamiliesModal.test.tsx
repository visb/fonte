import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

let meetingState: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };
let historyState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../hooks/useSupportGroups', () => ({
  useSupportGroupMeetingDetail: () => meetingState,
  useResidentCheckinHistory: () => historyState,
}));

import { MeetingFamiliesModal } from './MeetingFamiliesModal';

beforeEach(() => {
  vi.clearAllMocks();
  meetingState = {
    data: {
      checkins: [
        { id: 'c1', residentId: 'r1', residentName: 'Ana' },
        { id: 'c2', residentId: 'r2', residentName: 'Bruno' },
      ],
    },
    isLoading: false,
  };
  historyState = {
    data: [{ meetingId: 'm9', date: '2026-06-01', groupName: 'Grupo Alfa' }],
    isLoading: false,
  };
});
afterEach(() => cleanup());

describe('MeetingFamiliesModal', () => {
  it('lista as famílias presentes', () => {
    render(<MeetingFamiliesModal meetingId="m1" onClose={vi.fn()} />);
    expect(screen.getByText('Famílias presentes')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('expande um residente e mostra histórico', () => {
    render(<MeetingFamiliesModal meetingId="m1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Ana'));
    expect(screen.getByText('Grupo Alfa')).toBeInTheDocument();
    expect(screen.getByText('01/06/2026')).toBeInTheDocument();
  });

  it('histórico vazio mostra estado vazio', () => {
    historyState = { data: [], isLoading: false };
    render(<MeetingFamiliesModal meetingId="m1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Ana'));
    expect(screen.getByText('Nenhuma participação anterior.')).toBeInTheDocument();
  });

  it('sem checkins mostra estado vazio', () => {
    meetingState = { data: { checkins: [] }, isLoading: false };
    render(<MeetingFamiliesModal meetingId="m1" onClose={vi.fn()} />);
    expect(screen.getByText('Nenhuma família registrada nesta reunião.')).toBeInTheDocument();
  });

  it('loading mostra LoadingState (sem famílias)', () => {
    meetingState = { data: undefined, isLoading: true };
    render(<MeetingFamiliesModal meetingId="m1" onClose={vi.fn()} />);
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });
});
