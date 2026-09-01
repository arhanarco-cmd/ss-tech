import React from 'react';

const WORDS = ["sexy", "beautiful", "sassy", "shreya", "gorgeous", "queen", "diva", "chic", "glam", "babe", "fabulous", "cute", "sparkle"];

export const DoodleBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none opacity-20">
      {WORDS.map((word, index) => {
        const top = `${Math.random() * 90}%`;
        const left = `${Math.random() * 90}%`;
        const rotate = `${Math.floor(Math.random() * 45) - 20}deg`;
        const fontSize = `${Math.max(2, Math.random() * 5)}rem`;
        const animDelay = `${Math.random() * 5}s`;

        return (
          <div
            key={index}
            className="absolute font-extrabold tracking-widest text-primary mix-blend-overlay drop-shadow-md animate-fade-in"
            style={{
              top,
              left,
              transform: `rotate(${rotate})`,
              fontSize,
            }}
          >
            <div style={{
              animationDelay: animDelay,
              animationDuration: '10s',
              animationIterationCount: 'infinite',
              animationName: 'float',
            }}>
              {word}
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
};
