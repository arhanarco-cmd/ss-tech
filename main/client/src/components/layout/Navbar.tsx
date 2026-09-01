import type { FC } from 'react';
import { Menu } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar: FC<NavbarProps> = ({ onMenuClick }) => {
  const { role } = useAppStore();

  let cushionClass = "bg-purple-950/60 border border-purple-500/40 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-md";
  let typographyClass = "font-black tracking-widest text-purple-200 drop-shadow-[0_2px_4px_rgba(168,85,247,0.3)] text-lg sm:text-xl";

  if (role === 'user') {
    cushionClass = "bg-white/85 border border-pink-300 shadow-[0_0_25px_rgba(244,63,94,0.35)] backdrop-blur-md";
    typographyClass = "font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 drop-shadow-[0_2px_4px_rgba(244,63,94,0.3)] text-lg sm:text-xl";
  } else if (role === 'admin') {
    cushionClass = "bg-orange-950/70 border border-orange-500/50 text-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.4)] backdrop-blur-md";
    typographyClass = "font-black tracking-widest text-orange-300 drop-shadow-[0_2px_4px_rgba(249,115,22,0.3)] text-lg sm:text-xl";
  }

  return (
    <nav className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm z-50 sticky top-0 shadow-sm transition-colors duration-500">
      <div className="flex items-center gap-4">
        <div className={`px-4 py-1.5 rounded-full z-50 flex items-center transition-all duration-500 ${cushionClass}`}>
          <h1 className={typographyClass}>
            sexyshreya.tech
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick} 
          aria-label="Open menu"
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
};
