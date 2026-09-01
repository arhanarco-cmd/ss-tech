import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Navbar } from './components/layout/Navbar';
import { Drawer } from './components/layout/Drawer';
import { AboutModal } from './components/layout/AboutModal';
import { DoodleBackground } from './components/layout/DoodleBackground';
import { MainGallery } from './components/gallery/MainGallery';
import { HiddenGallery } from './components/gallery/HiddenGallery';
import { PinModal } from './components/auth/PinModal';
import { VideoCallRoom } from './components/call/VideoCallRoom';
import { UploadModal } from './components/gallery/UploadModal';
import { socket } from './services/socket';

import { API_BASE } from './services/api';

import { ThoughtStream } from './components/layout/ThoughtStream';

function App() {
  const { role, adminLive, activeCallId, setAdminLive, currentView, setRole, setMainImages, setHiddenImages, setIsLoadingGallery } = useAppStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    // Session restore
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setRole(data.role);
          document.documentElement.setAttribute('data-theme', data.role);
        }
      })
      .catch(err => console.error('Auth check failed', err));

    // Gallery fetch
    setIsLoadingGallery(true);
    fetch(`${API_BASE}/api/gallery`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const main = data.filter((d: any) => !d.isPrivate);
          const hidden = data.filter((d: any) => d.isPrivate);
          setMainImages(main);
          setHiddenImages(hidden);
        }
      })
      .catch(err => console.error('Gallery fetch failed', err))
      .finally(() => setIsLoadingGallery(false));
  }, [setRole, setMainImages, setHiddenImages, setIsLoadingGallery]);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', role);
  }, [role]);

  // Apply admin live state
  useEffect(() => {
    document.documentElement.setAttribute('data-admin-live', String(adminLive));
  }, [adminLive]);

  // Socket connection for admin presence
  useEffect(() => {
    // Reconnect to ensure new cookies are passed in handshake
    socket.disconnect();
    socket.connect();
    
    if (role === 'admin') {
      setAdminLive(true);
      socket.emit('admin:login');
    }

    socket.on('admin:status', (data: { isLive: boolean }) => {
      setAdminLive(data.isLive);
    });

    return () => {
      socket.off('admin:status');
    };
  }, [role, setAdminLive]);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {role === 'user' && (
        <>
          <DoodleBackground />
          <ThoughtStream />
        </>
      )}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar onMenuClick={() => setDrawerOpen(true)} />
        
        <Drawer 
          isOpen={drawerOpen} 
          onClose={() => setDrawerOpen(false)} 
          onAboutClick={() => setAboutModalOpen(true)}
          onUnlockClick={() => setPinModalOpen(true)}
        />
        
        <main className="flex-grow p-4 md:p-8 bg-transparent">
          {activeCallId ? (
            <VideoCallRoom sessionId={activeCallId} />
          ) : (
            <>
              {currentView === 'home' && <MainGallery onUploadClick={() => setUploadModalOpen(true)} />}
              {currentView === 'more' && (role === 'user' || role === 'admin') && <HiddenGallery onUploadClick={() => setUploadModalOpen(true)} />}
            </>
          )}
        </main>

        <PinModal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} />
        <AboutModal isOpen={aboutModalOpen} onClose={() => setAboutModalOpen(false)} />
        <UploadModal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} />
      </div>
    </div>
  );
}

export default App;