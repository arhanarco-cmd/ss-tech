import { create } from 'zustand';

type Role = 'default' | 'user' | 'admin';

export interface GalleryItem {
  id: string;
  url: string;
  title: string;
  isPrivate: boolean;
  createdAt?: string;
}

interface AppState {
  role: Role;
  isAuthenticated: boolean;
  adminLive: boolean;
  activeCallId: string | null;
  currentView: 'home' | 'more';
  mainImages: GalleryItem[];
  hiddenImages: GalleryItem[];
  isLoadingGallery: boolean;
  setRole: (role: Role) => void;
  setAdminLive: (live: boolean) => void;
  setActiveCallId: (id: string | null) => void;
  setCurrentView: (view: 'home' | 'more') => void;
  addMainImage: (item: GalleryItem) => void;
  addHiddenImage: (item: GalleryItem) => void;
  removeMainImage: (id: string) => void;
  removeHiddenImage: (id: string) => void;
  setMainImages: (images: GalleryItem[]) => void;
  setHiddenImages: (images: GalleryItem[]) => void;
  setIsLoadingGallery: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: 'default',
  isAuthenticated: false,
  adminLive: false,
  activeCallId: null,
  currentView: 'home',
  mainImages: [],
  hiddenImages: [],
  isLoadingGallery: true,
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
  removeMainImage: (id) => set((state) => ({ mainImages: state.mainImages.filter((img) => img.id !== id) })),
  removeHiddenImage: (id) => set((state) => ({ hiddenImages: state.hiddenImages.filter((img) => img.id !== id) })),
  setMainImages: (images) => set({ mainImages: images }),
  setHiddenImages: (images) => set({ hiddenImages: images }),
  setIsLoadingGallery: (loading) => set({ isLoadingGallery: loading }),
}));
