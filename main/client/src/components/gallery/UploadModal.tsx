import { useState, useRef, useEffect, type FC } from 'react';
import { X, Camera, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { API_BASE } from '../../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadModal: FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'picker' | 'camera'>('picker');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentView, addMainImage, addHiddenImage } = useAppStore();

  // Stop camera when unmounting or switching modes
  useEffect(() => {
    return () => stopCamera();
  }, [isOpen, mode]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera');
      setMode('picker');
    }
  };

  const handleModeSwitch = (newMode: 'picker' | 'camera') => {
    if (newMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    setMode(newMode);
    setPreviewSrc(null);
  };

  const [selectedFile, setSelectedFile] = useState<Blob | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewSrc(URL.createObjectURL(file));
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          setSelectedFile(blob);
          setPreviewSrc(URL.createObjectURL(blob));
        }
      }, 'image/jpeg');
    }
    stopCamera();
  };

  const handleSubmit = async () => {
    if (selectedFile) {
      const formData = new FormData();
      formData.append('file', selectedFile, 'upload.jpg');
      formData.append('isPrivate', currentView === 'more' ? 'true' : 'false');
      
      try {
        const res = await fetch(`${API_BASE}/api/gallery/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          if (currentView === 'home') {
            useAppStore.getState().setMainImages([data, ...useAppStore.getState().mainImages]);
          } else {
            useAppStore.getState().setHiddenImages([data, ...useAppStore.getState().hiddenImages]);
          }
          // Simple toast
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-up';
          toast.innerText = 'Upload successful!';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        }
      } catch (err) {
        console.error('Upload failed', err);
      }
    }
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setPreviewSrc(null);
    setSelectedFile(null);
    setMode('picker');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Upload Media
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-full transition-colors" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-grow flex flex-col">
          {!previewSrc ? (
            <>
              <div className="flex gap-2 mb-4 bg-white/5 p-1 rounded-lg">
                <button 
                  onClick={() => handleModeSwitch('picker')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'picker' ? 'bg-primary/20 text-primary' : 'text-white/50 hover:text-white/80'}`}
                >
                  Storage Picker
                </button>
                <button 
                  onClick={() => handleModeSwitch('camera')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'camera' ? 'bg-primary/20 text-primary' : 'text-white/50 hover:text-white/80'}`}
                >
                  Live Camera
                </button>
              </div>

              {mode === 'picker' ? (
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-white/5 hover:bg-white/10 transition-colors">
                  <ImageIcon className="w-10 h-10 text-white/30" />
                  <p className="text-sm text-white/70">Click to browse or drag & drop</p>
                  <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors mt-2">
                    Select File
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                  </label>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-black rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex justify-center gap-3">
                    <button 
                      onClick={handleCapture}
                      className="bg-primary hover:bg-primary/80 text-white px-6 py-2 flex items-center gap-2 rounded-full font-medium transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Snapshot
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-square flex items-center justify-center">
                <img src={previewSrc} alt="Preview" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPreviewSrc(null)}
                  className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-medium transition-colors"
                >
                  Retake
                </button>
                <button 
                  onClick={handleSubmit}
                  className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/80 text-white font-medium transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
