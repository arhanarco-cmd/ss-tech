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

function App() {
  const { role, adminLive, activeCallId, setAdminLive, currentView } = useAppStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

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
      <DoodleBackground />
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-blob bg-primary transition-colors duration-1000" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob bg-accent transition-colors duration-1000" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob bg-primary transition-colors duration-1000" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar onMenuClick={() => setDrawerOpen(true)} />
        
        <Drawer 
          isOpen={drawerOpen} 
          onClose={() => setDrawerOpen(false)} 
          onAboutClick={() => setAboutModalOpen(true)}
          onUnlockClick={() => setPinModalOpen(true)}
        />
        
        <main className="flex-grow p-4 md:p-8 backdrop-blur-md bg-surface/40">
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