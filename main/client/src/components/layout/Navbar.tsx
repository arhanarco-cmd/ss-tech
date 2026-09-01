import type { FC } from 'react';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar: FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="flex items-center justify-between p-4 border-b border-white/10 bg-surface z-40 sticky top-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-rose-400 drop-shadow-[0_2px_12px_rgba(244,63,94,0.7)]">
          SEXYSHREYA GALLERY
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick} 
          aria-label="Open menu"
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
};
