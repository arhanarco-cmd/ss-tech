import { useState, type FC } from 'react';
import { Upload, Download, Trash2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface HiddenGalleryProps {
  onUploadClick: () => void;
}

import { FLIRTY_QUOTES } from '../../constants/quotes';

export const HiddenGallery: FC<HiddenGalleryProps> = ({ onUploadClick }) => {
  const { role, hiddenImages, removeHiddenImage } = useAppStore();
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<string>('');

  const handleDownload = (e: React.MouseEvent, src: string) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = src;
    a.download = `hidden_item_${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    removeHiddenImage(index);
  };

  return (
    <div className="animate-slide-up mb-12">
      <div className="flex justify-end mb-4">
        <button onClick={onUploadClick} className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors shadow-sm">
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Add Photo/Video</span>
        </button>
      </div>

      {hiddenImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-primary/60 border-2 border-pink-200/50 border-dashed rounded-2xl bg-white/20">
          <p className="font-bold tracking-wide">No private items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {hiddenImages.map((src, idx) => (
            <div 
              key={idx} 
              className="aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-pink-200/50 bg-white/20 hover:scale-[1.02] flex items-center justify-center relative group cursor-pointer"
              onClick={() => {
                setSelectedImg(src);
                setSelectedCaption(FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)]);
              }}
            >
              <img 
                src={src} 
                alt="Hidden item" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
              
              {role === 'admin' && (
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button aria-label="Download item" onClick={(e) => handleDownload(e, src)} className="p-2 bg-black/60 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors shadow-md">
                    <Download className="w-4 h-4" />
                  </button>
                  <button aria-label="Delete item" onClick={(e) => handleDelete(e, idx)} className="p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-md">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedImg && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImg(null)}
        >
          <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <img 
              src={selectedImg} 
              alt="Preview" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="bg-white/20 border border-pink-300/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] rounded-full px-6 py-3 text-pink-100 font-medium text-sm sm:text-base backdrop-blur-md max-w-[90%] text-center">
              {selectedCaption}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
