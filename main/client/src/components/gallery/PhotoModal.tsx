import { FC, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { GalleryItem, useAppStore } from '../../store/useAppStore';
import { API_BASE } from '../../services/api';

interface PhotoModalProps {
  item: GalleryItem;
  caption: string;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const PhotoModal: FC<PhotoModalProps> = ({ item, caption, onClose, onDelete }) => {
  const { role } = useAppStore();
  const [isDeleting, setIsDeleting] = useState(false);

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
          onClose();
        } else {
          console.error('Failed to delete');
          setIsDeleting(false);
        }
      } catch (err) {
        console.error('Delete error', err);
        setIsDeleting(false);
      }
    }
  };

  const showControls = role === 'admin' || role === 'user';

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button aria-label="Close modal" className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors z-10">
        <X className="w-8 h-8" />
      </button>
      
      {role === 'admin' && (
        <button 
          aria-label="Delete item from modal" 
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-4 right-20 p-2 text-white hover:bg-red-500 hover:text-white rounded-full transition-colors z-10 bg-black/50"
        >
          <Trash2 className="w-6 h-6" />
        </button>
      )}

      <div className="flex flex-col items-center gap-4 max-w-full" onClick={e => e.stopPropagation()}>
        <img 
          src={item.url} 
          alt="Preview" 
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        {caption && (
          <div className="bg-white/20 border border-pink-300/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] rounded-full px-6 py-3 text-pink-100 font-medium text-sm sm:text-base backdrop-blur-md max-w-[90%] text-center">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
