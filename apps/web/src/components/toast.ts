import { create } from 'zustand';

export interface ToastItem {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (tone: ToastItem['tone'], message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (tone, message) => {
    const id = ++seq;
    set({ items: [...get().items.slice(-2), { id, tone, message }] });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 4500 : 2800);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
  info: (m: string) => useToasts.getState().push('info', m),
};
