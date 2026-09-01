import { FC, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useAppStore, GalleryItem, getMediaUrl } from '../../store/useAppStore';
import { API_BASE } from '../../services/api';
import { FLIRTY_QUOTES } from '../../constants/quotes';

interface GalleryCardProps {
  item: GalleryItem;
  idx: number;
  onSelect: (item: GalleryItem, caption: string) => void;
  onDelete: (id: string) => void;
}

export const GalleryCard: FC<GalleryCardProps> = ({ item, idx, onSelect, onDelete }) => {
  const { role } = useAppStore();
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = getMediaUrl(item.url);
    a.download = `gallery_item_${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this media?')) {
      setIsDeleting(true);
      try {
        const res = await fetch(`${API_BASE}/api/gallery/item?key=${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (res.ok) {
          onDelete(item.id);
        } else {
          console.error('Failed to delete');
        }
      } catch (err) {
        console.error('Delete error', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const showControls = role === 'admin' || role === 'user';

  return (
    <div 
      className={`aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-pink-200/50 bg-white/20 hover:scale-[1.02] cursor-pointer relative group animate-fade-in ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ animationDelay: `${idx * 100}ms` }}
      onClick={() => {
        onSelect(item, FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)]);
      }}
    >
      {imageError ? (
        <div className="w-full h-full bg-gradient-to-br from-pink-200 to-orange-200 flex items-center justify-center text-pink-500 font-medium">
          Media Unavailable
        </div>
      ) : (
        <img 
          src={getMediaUrl(item.url)} 
          alt={item.title || 'Gallery item'} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
      
      {showControls && (
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <button aria-label="Download item" onClick={handleDownload} className="p-2 bg-black/60 hover:bg-primary text-white rounded-lg backdrop-blur-sm transition-colors shadow-md">
            <Download className="w-4 h-4" />
          </button>
          {role === 'admin' && (
            <button aria-label="Delete item" onClick={handleDelete} className="p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-md">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
