import React from 'react';

const WORDS = [
  "shreya", "sexy", "gorgeous", "sassy", "queen", "babe", "diva", "sparkle", 
  "angel", "iconic", "slay", "aesthetic", "cute", "hot", "flawless", "dreamy", 
  "chic", "glam", "doll", "toxic", "heavenly", "tempting", "radiant", "irresistible",
  "shreya", "sexy", "gorgeous", "sassy", "queen", "babe", "diva", "sparkle",
  "angel", "iconic", "slay", "aesthetic", "cute", "hot", "flawless", "dreamy",
  "chic", "glam", "doll"
]; // 43 words

const COLORS = ['text-pink-500/50', 'text-rose-500/55', 'text-fuchsia-500/45'];

export const DoodleBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      {WORDS.map((word, index) => {
        const top = `${Math.random() * 110 - 5}%`;
        const left = `${Math.random() * 110 - 5}%`;
        const rot = `${Math.floor(Math.random() * 50) - 25}deg`; // -25 to +25
        const fontSize = `${Math.max(1, Math.random() * 2.5)}rem`;
        const animDelay = `-${Math.random() * 20}s`; // Negative delay so they start immediately at different points
        const animDuration = `${12 + Math.random() * 16}s`; // 12s to 28s
        const colorClass = COLORS[index % COLORS.length];
        
        // Randomly pick one of the 4 drift animations
        const driftAnim = `drift-${(index % 4) + 1}`;

        return (
          <div
            key={index}
            className={`absolute font-extrabold tracking-widest ${colorClass} drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]`}
            style={{
              top,
              left,
              fontSize,
              '--rot': rot
            } as React.CSSProperties}
          >
            <div style={{
              animationDelay: animDelay,
              animationDuration: animDuration,
              animationIterationCount: 'infinite',
              animationName: driftAnim,
              animationTimingFunction: 'ease-in-out',
              animationDirection: 'alternate'
            }}>
              {word}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes drift-1 { 
          0% { transform: translate(0px, 0px) rotate(var(--rot)); } 
          100% { transform: translate(30px, -30px) rotate(calc(var(--rot) + 10deg)); } 
        }
        @keyframes drift-2 { 
          0% { transform: translate(0px, 0px) rotate(var(--rot)); } 
          100% { transform: translate(-30px, -20px) rotate(calc(var(--rot) - 15deg)); } 
        }
        @keyframes drift-3 { 
          0% { transform: translate(0px, 0px) rotate(var(--rot)); } 
          100% { transform: translate(20px, 30px) rotate(calc(var(--rot) + 15deg)); } 
        }
        @keyframes drift-4 { 
          0% { transform: translate(0px, 0px) rotate(var(--rot)); } 
          100% { transform: translate(-25px, 25px) rotate(calc(var(--rot) - 10deg)); } 
        }
      `}</style>
    </div>
  );
};
