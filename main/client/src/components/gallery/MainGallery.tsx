import { useState, type FC } from 'react';
import { X, Download, Trash2, Upload } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface MainGalleryProps {
  onUploadClick: () => void;
}

export const MainGallery: FC<MainGalleryProps> = ({ onUploadClick }) => {
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const { role, publicImages } = useAppStore();

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h2 className="text-2xl font-bold">Public Gallery</h2>
        {(role === 'admin' || role === 'user') && (
          <button onClick={onUploadClick} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Add Photo/Video</span>
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {publicImages.map((src, idx) => (
          <div 
            key={idx} 
            className="aspect-square overflow-hidden rounded-xl cursor-pointer relative group bg-white/5 animate-fade-in"
            style={{ animationDelay: `${idx * 100}ms` }}
            onClick={() => setSelectedImg(src)}
          >
            <img 
              src={src} 
              alt="Gallery item" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
            
            {role === 'admin' && (
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={e => e.stopPropagation()}>
                <button aria-label="Download item" className="p-2 bg-black/60 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button aria-label="Delete item" className="p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedImg && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImg(null)}
        >
          <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
          <img 
            src={selectedImg} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
