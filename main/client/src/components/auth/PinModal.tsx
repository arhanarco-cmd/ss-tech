import { useState, useEffect, type FC } from 'react';
import { X, Delete, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { API_BASE } from '../../services/api';

export const PinModal: FC<PinModalProps> = ({ isOpen, onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setRole } = useAppStore();

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError(false);
      setShake(false);
      setLoading(false);
    }
  }, [isOpen]);

  const verifyPinWithBackend = async (pinToVerify: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: pinToVerify }),
      });

      if (response.ok) {
        const data = await response.json();
        setRole(data.role);
        onClose();
      } else {
        triggerErrorState();
      }
    } catch {
      triggerErrorState();
    } finally {
      setLoading(false);
    }
  };

  const triggerErrorState = () => {
    setError(true);
    setShake(true);
    setPin('');
    setTimeout(() => {
      setShake(false);
      setError(false);
    }, 500);
  };

  useEffect(() => {
    if (pin.length === 6 && !loading) {
      verifyPinWithBackend(pin);
    }
  }, [pin, loading]);

  if (!isOpen) return null;

  const handleInput = (num: string) => {
    if (loading) return;
    setPin(prev => (prev.length < 6 ? prev + num : prev));
    setError(false);
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm px-4">
      <div className={`bg-surface border border-white/10 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl animate-slide-up ${shake ? 'animate-shake' : ''}`}>
        <button 
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Enter PIN</h2>
          <p className="text-sm text-white/50">Enter passcode to unlock gallery</p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${
                i < pin.length ? 'bg-primary border-primary' : 'border-white/20'
              } ${error ? 'bg-red-500 border-red-500' : ''} transition-colors`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              disabled={loading}
              onClick={() => handleInput(num.toString())}
              className="aspect-square rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-xl font-medium transition-colors disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            disabled={loading}
            onClick={() => handleInput('0')}
            className="aspect-square rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-xl font-medium transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            disabled={loading}
            onClick={handleDelete}
            className="aspect-square rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <button
          onClick={() => verifyPinWithBackend(pin)}
          disabled={pin.length < 6 || loading}
          className="w-full py-4 rounded-xl bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Unlock'}
        </button>
      </div>
    </div>
  );
};