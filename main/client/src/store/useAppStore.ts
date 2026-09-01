import { create } from 'zustand';

type Role = 'default' | 'user' | 'admin';

interface AppState {
  role: Role;
  isAuthenticated: boolean;
  adminLive: boolean;
  activeCallId: string | null;
  currentView: 'home' | 'more';
  publicImages: string[];
  hiddenImages: string[];
  setRole: (role: Role) => void;
  setAdminLive: (live: boolean) => void;
  setActiveCallId: (id: string | null) => void;
  setCurrentView: (view: 'home' | 'more') => void;
  addPublicImage: (src: string) => void;
  addHiddenImage: (src: string) => void;
}

const initialPublicImages = [
  'https://images.unsplash.com/photo-1506744626753-143683923ee9?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1470770903672-7ccea069c98b?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=800',
];

export const useAppStore = create<AppState>((set) => ({
  role: 'default',
  isAuthenticated: false,
  adminLive: false,
  activeCallId: null,
  currentView: 'home',
  publicImages: initialPublicImages,
  hiddenImages: [],
  setRole: (role) => set({ role, isAuthenticated: role !== 'default' }),
  setAdminLive: (live) => set({ adminLive: live }),
  setActiveCallId: (id) => set({ activeCallId: id }),
  setCurrentView: (view) => set({ currentView: view }),
  addPublicImage: (src) => set((state) => ({ publicImages: [...state.publicImages, src] })),
  addHiddenImage: (src) => set((state) => ({ hiddenImages: [...state.hiddenImages, src] })),
}));
