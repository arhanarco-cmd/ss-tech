import { type FC } from 'react';
import { X, User, Lock, Unlock, Phone, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAboutClick: () => void;
  onUnlockClick: () => void;
}

export const Drawer: FC<DrawerProps> = ({ isOpen, onClose, onAboutClick, onUnlockClick }) => {
  const { role, adminLive, setActiveCallId, currentView, setCurrentView, setRole } = useAppStore();

  const handleCall = () => {
    setActiveCallId(Math.random().toString(36).substring(7));
    onClose();
  };

  const navigateTo = (view: 'home' | 'more') => {
    setCurrentView(view);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    }
    setRole('default');
    setCurrentView('home');
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm" 
          onClick={onClose}
        />
      )}
      <div 
        className={`fixed inset-y-0 right-0 w-80 bg-surface border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}
      >
        <div className="p-4 flex justify-between items-center border-b border-white/10 sticky top-0 bg-surface z-10">
          <h2 className="font-bold text-lg tracking-wide">Menu</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          
          {/* Card 1: About Me */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { onAboutClick(); onClose(); }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/20 rounded-lg text-primary">
                <User className="w-5 h-5" />
              </div>
              <h3 className="font-semibold">About Me & Tech Stack</h3>
            </div>
            <p className="text-sm text-white/50 ml-11">
              View developer bio, skills, and framework tags.
            </p>
          </div>

          {/* Card 2: Unlock / More Gallery */}
          {role === 'default' ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { onUnlockClick(); onClose(); }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg text-white/70">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">Unlock More Gallery</h3>
              </div>
              <p className="text-sm text-white/50 ml-11">
                Enter PIN to unlock hidden gallery items.
              </p>
            </div>
          ) : (
            <div className="bg-white/5 border border-primary/30 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-primary">Gallery Unlocked</h3>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  aria-label="Lock Gallery and Logout"
                  title="Lock Gallery & Logout"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex flex-col gap-2 ml-11 mt-1">
                <button 
                  onClick={() => navigateTo('home')}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${currentView === 'home' ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-white/70'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Home Gallery
                </button>
                <button 
                  onClick={() => navigateTo('more')}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${currentView === 'more' ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-white/70'}`}
                >
                  <ImageIcon className="w-4 h-4" /> View More Gallery
                </button>
                <button 
                  onClick={handleLogout}
                  className="mt-2 flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors w-full font-medium"
                >
                  <Lock className="w-4 h-4" /> Lock Gallery & Logout
                </button>
              </div>
            </div>
          )}

          {/* Card 3: Video Call Room */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${adminLive ? 'bg-green-500/20 text-green-500' : 'bg-white/10 text-white/70'}`}>
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">Video Call Room</h3>
              </div>
            </div>
            
            <div className="ml-11 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${adminLive ? 'bg-green-500 animate-pulse' : 'bg-white/30'}`} />
                <span className={adminLive ? 'text-green-500 font-medium' : 'text-white/50'}>
                  {adminLive ? 'Admin is Online' : 'Admin is Offline'}
                </span>
              </div>
              
              <button 
                onClick={handleCall}
                className={`btn-call w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${adminLive ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] border border-green-400' : 'bg-white/10 hover:bg-white/20 text-white/70 border border-transparent'}`}
              >
                <Phone className="w-4 h-4" />
                Initiate Call
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
