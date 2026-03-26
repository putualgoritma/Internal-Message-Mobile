import {create} from 'zustand';

export type RealtimeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

interface RealtimeState {
  status: RealtimeStatus;
  lastEvent: string | null;
  lastEventAt: string | null;
  setStatus: (status: RealtimeStatus) => void;
  setLastEvent: (eventName: string) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>(set => ({
  status: 'disconnected',
  lastEvent: null,
  lastEventAt: null,
  setStatus: status => set({status}),
  setLastEvent: eventName =>
    set({
      lastEvent: eventName,
      lastEventAt: new Date().toISOString(),
    }),
  reset: () =>
    set({
      status: 'disconnected',
      lastEvent: null,
      lastEventAt: null,
    }),
}));
