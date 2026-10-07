import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  // We can add global auth state here later if needed
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));
