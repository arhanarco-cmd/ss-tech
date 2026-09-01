import type { FC } from 'react';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar: FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="flex items-center justify-between p-4 border-b border-white/10 bg-surface z-40 sticky top-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-wider">SSTECH GALLERY</h1>
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
