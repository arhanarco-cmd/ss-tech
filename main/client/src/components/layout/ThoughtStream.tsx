import React, { useState, useEffect } from 'react';
import { FLIRTY_QUOTES } from '../../constants/quotes';

export const ThoughtStream: React.FC = () => {
  const [currentQuote, setCurrentQuote] = useState('');
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Pick an initial quote
    setCurrentQuote(FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)]);
    
    const interval = setInterval(() => {
      setCurrentQuote(FLIRTY_QUOTES[Math.floor(Math.random() * FLIRTY_QUOTES.length)]);
      setKey(prev => prev + 1);
    }, 4500); // cycle every 4.5s
    
    return () => clearInterval(interval);
  }, []);

  if (!currentQuote) return null;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-10 z-40 pointer-events-none">
      <div 
        key={key} 
        className="bg-white/85 border border-pink-300 shadow-[0_4px_20px_rgba(244,63,94,0.25)] rounded-full px-5 py-2.5 text-rose-800 font-semibold text-xs sm:text-sm backdrop-blur-md animate-thought-stream whitespace-nowrap"
      >
        {currentQuote}
      </div>
      
      <style>{`
        @keyframes thought-stream {
          0% { opacity: 0; transform: translateY(20px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-thought-stream {
          animation: thought-stream 4.5s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};
