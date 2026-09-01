import type { FC } from 'react';
import { X, Code, Shield, Server, Database } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm px-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <h2 className="text-2xl font-bold">About Me & Tech Stack</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-primary font-semibold mb-3">Developer Bio</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Shreya is a passionate software developer focusing on modern web technologies, 
              scalable architecture, and seamless user experiences. 
              Always eager to build high-performance applications with elegant code. With.....
            </p>
          </section>

          <section>
            <h3 className="text-primary font-semibold mb-3">Technical Stack</h3>
            <div className="flex flex-wrap gap-2">
              {['React 18', 'TypeScript', 'Vite', 'Tailwind', 'Zustand', 'Socket.IO', 'WebRTC', 'Node.js', 'Playwright'].map(tech => (
                <span key={tech} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-primary font-semibold mb-4">Architecture Highlights</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Dual-Role Authentication</p>
                  <p className="text-xs text-white/50">PIN-based access with rate limiting.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Code className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Dynamic Theming</p>
                  <p className="text-xs text-white/50">Role-driven UI changes with CSS variables.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Server className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm font-medium">WebRTC Video Call</p>
                  <p className="text-xs text-white/50">P2P connection with canvas compositing.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Database className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Cloud-Ready Storage</p>
                  <p className="text-xs text-white/50">Modular pipeline for local or R2 storage.</p>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
