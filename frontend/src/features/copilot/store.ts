import { create } from 'zustand';
import type { AISettings, ChatMessage } from './types';

interface CopilotState {
  // Settings
  settings: AISettings;
  updateSettings: (newSettings: Partial<AISettings>) => void;

  // Drawer UI state
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Chat conversation
  messages: ChatMessage[];
  isGenerating: boolean;
  setIsGenerating: (status: boolean) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Store Scoping
  selectedStoreId: string | null;
  setSelectedStoreId: (storeId: string | null) => void;
}

const SETTINGS_STORAGE_KEY = 'storecraft_ai_settings';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  apiKey: '',
  systemPrompt: 'You are StoreCraft Retail Copilot, an AI assistant with access to real-time ERP tools.',
};

function loadSettingsFromStorage(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to parse AI settings from storage:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettingsToStorage(settings: AISettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to persist AI settings to storage:', e);
  }
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-1',
  role: 'assistant',
  content: `### 👋 Welcome to StoreCraft Retail Copilot!

I am your AI assistant grounded in real-time retail ERP data via **Store App Model Context Protocol (MCP)** tools.

I can help you analyze:
- 📊 **Daily Sales & Revenue**: Turnover, AOV, invoices, and tender methods.
- 📦 **Inventory & Restock**: Stock alerts, valuations, and low-inventory reorders.
- 🧾 **GST Filing & Taxes**: GSTR-1, GSTR-3B liability, and ITC credit reconciliation.
- 👤 **Customer 360**: Loyalty reward balances, visit counts, and purchase history.
- 🏪 **Multi-Store Operations**: Physical store directory, orders, and fulfillment.

*Select a quick prompt below or type any question to get started.*`,
  timestamp: new Date().toISOString(),
  mode: 'offline',
};

export const useCopilotStore = create<CopilotState>((set) => ({
  settings: loadSettingsFromStorage(),
  updateSettings: (newSettings) =>
    set((state) => {
      const merged = { ...state.settings, ...newSettings };
      saveSettingsToStorage(merged);
      return { settings: merged };
    }),

  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  messages: [WELCOME_MESSAGE],
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [WELCOME_MESSAGE] }),

  selectedStoreId: null,
  setSelectedStoreId: (selectedStoreId) => set({ selectedStoreId }),
}));
