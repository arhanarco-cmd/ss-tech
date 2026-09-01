import { useState, type FC } from 'react';
import { Upload } from 'lucide-react';
import { useAppStore, GalleryItem } from '../../store/useAppStore';
import { GalleryCard } from './GalleryCard';
import { PhotoModal } from './PhotoModal';

interface HiddenGalleryProps {
  onUploadClick: () => void;
}

export const HiddenGallery: FC<HiddenGalleryProps> = ({ onUploadClick }) => {
  const { hiddenImages, removeHiddenImage, isLoadingGallery } = useAppStore();
  const [selectedImg, setSelectedImg] = useState<{ item: GalleryItem, caption: string } | null>(null);

  return (
    <div className="animate-slide-up mb-12">
      <div className="flex justify-end mb-4">
        <button onClick={onUploadClick} className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors shadow-sm">
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Add Photo/Video</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoadingGallery ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="aspect-square rounded-2xl bg-white/10 border border-white/5 animate-pulse shadow-sm"></div>
          ))
        ) : hiddenImages.length > 0 ? (
          hiddenImages.map((item, idx) => (
            <GalleryCard 
              key={item.id || idx} 
              item={item} 
              idx={idx}
              onSelect={(item, caption) => setSelectedImg({ item, caption })}
              onDelete={removeHiddenImage}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-20 text-rose-300 font-medium text-sm">
            ✨ No uploads yet. Click "+ Add Photo/Video" to add your first memory! ✨
          </div>
        )}
      </div>

      {selectedImg && (
        <PhotoModal 
          item={selectedImg.item} 
          caption={selectedImg.caption} 
          onClose={() => setSelectedImg(null)} 
          onDelete={removeHiddenImage} 
        />
      )}
    </div>
  );
};
