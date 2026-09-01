import { create } from 'zustand';

type Role = 'default' | 'user' | 'admin';

interface AppState {
  role: Role;
  isAuthenticated: boolean;
  adminLive: boolean;
  activeCallId: string | null;
  currentView: 'home' | 'more';
  mainImages: string[];
  hiddenImages: string[];
  setRole: (role: Role) => void;
  setAdminLive: (live: boolean) => void;
  setActiveCallId: (id: string | null) => void;
  setCurrentView: (view: 'home' | 'more') => void;
  addMainImage: (src: string) => void;
  addHiddenImage: (src: string) => void;
  removeMainImage: (index: number) => void;
  removeHiddenImage: (index: number) => void;
}

const initialMainImages = [
  'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=80&w=800',
];

export const useAppStore = create<AppState>((set) => ({
  role: 'default',
  isAuthenticated: false,
  adminLive: false,
  activeCallId: null,
  currentView: 'home',
  mainImages: initialMainImages,
  hiddenImages: [],
  setRole: (role) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', role || 'default');
    }
    set({ role, isAuthenticated: role !== 'default' });
  },
  setAdminLive: (live) => set({ adminLive: live }),
  setActiveCallId: (id) => set({ activeCallId: id }),
  setCurrentView: (view) => set({ currentView: view }),
  addMainImage: (src) => set((state) => ({ mainImages: [...state.mainImages, src] })),
  addHiddenImage: (src) => set((state) => ({ hiddenImages: [...state.hiddenImages, src] })),
  removeMainImage: (index) => set((state) => ({ mainImages: state.mainImages.filter((_, i) => i !== index) })),
  removeHiddenImage: (index) => set((state) => ({ hiddenImages: state.hiddenImages.filter((_, i) => i !== index) })),
}));
