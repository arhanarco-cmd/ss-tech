import { useEffect, useRef, useState, type FC } from 'react';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, PhoneCall, MessageSquare } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { createCompositeStream } from '../../services/recordingCompositor';
import { CallRecorder } from '../../services/callRecorder';

interface VideoCallRoomProps {
  sessionId: string;
}

type CallState = 'idle' | 'connecting' | 'active' | 'ended';

export const VideoCallRoom: FC<VideoCallRoomProps> = ({ sessionId }) => {
  const { setActiveCallId } = useAppStore();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<CallRecorder | null>(null);

  // Initialize local camera in idle state
  useEffect(() => {
    if (callState === 'idle') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          localStreamRef.current = stream;
          if (idleVideoRef.current) {
            idleVideoRef.current.srcObject = stream;
          }
        })
        .catch(console.error);
    }
  }, [callState]);

  // Clean up all streams on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      remoteStreamRef.current?.getTracks().forEach(t => t.stop());
      compositeStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleStartCall = async () => {
    setCallState('connecting');
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Mock Remote Stream
      remoteStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }

      compositeStreamRef.current = createCompositeStream(localStreamRef.current, remoteStreamRef.current);
      recorderRef.current = new CallRecorder(compositeStreamRef.current, sessionId);
      recorderRef.current.start();
      setIsRecording(true);
      setCallState('active');

    } catch (err) {
      console.error('Failed to start call', err);
      setCallState('idle');
    }
  };

  const handleEndCall = () => {
    setCallState('ended');
    setIsRecording(false);
    recorderRef.current?.stop();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    remoteStreamRef.current?.getTracks().forEach(t => t.stop());
    compositeStreamRef.current?.getTracks().forEach(t => t.stop());
    
    setTimeout(() => {
      setActiveCallId(null);
    }, 2000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-black rounded-2xl overflow-hidden relative">
      <div className={`flex-grow flex flex-col relative transition-all ${showChat ? 'mr-80' : ''}`}>
        
        {isRecording && callState === 'active' && (
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            REC
          </div>
        )}

        {/* Call State Views */}
        {callState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-surface">
            <div className="w-48 h-48 rounded-full overflow-hidden mb-8 border-4 border-white/10 shadow-2xl relative">
              <video 
                ref={idleVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-bold mb-2">Ready to Connect</h2>
            <p className="text-white/50 mb-8">Click below when you are ready to join</p>
            <button 
              onClick={handleStartCall}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
            >
              <PhoneCall className="w-5 h-5" /> Start Video Call
            </button>
          </div>
        )}

        {callState === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-surface">
            <div className="flex gap-2 mb-4">
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <h2 className="text-xl font-medium animate-pulse">Ringing...</h2>
          </div>
        )}

        {callState === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-surface">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <PhoneOff className="w-8 h-8 text-white/50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
            <p className="text-white/50">Returning to gallery...</p>
          </div>
        )}

        {/* Active Call UI (Google Meet / Zoom PiP Layout) */}
        <div className={`absolute inset-0 w-full h-full bg-surface transition-opacity duration-500 ${callState === 'active' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
          
          {/* Main Remote Video (Background) */}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-28 left-4 bg-black/50 px-3 py-1 rounded-md text-sm backdrop-blur-sm z-20">
            Admin
          </div>

          {/* Local Video (PiP Bottom Right) */}
          <div className="absolute bottom-28 right-4 w-48 aspect-[3/4] md:w-64 md:aspect-video bg-black rounded-xl overflow-hidden border border-white/20 shadow-2xl group transition-transform hover:scale-105 z-20">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
            />
            {isCameraOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <CameraOff className="w-8 h-8 text-white/50" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-xs backdrop-blur-sm transition-opacity">
              You
            </div>
          </div>
        </div>

        {/* Controls - Only shown during active call */}
        <div className={`h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4 absolute bottom-0 inset-x-0 pb-4 transition-all duration-300 ${callState === 'active' ? 'z-30 translate-y-0 opacity-100' : 'z-0 translate-y-10 opacity-0 pointer-events-none'}`}>
          <button 
            onClick={toggleMute}
            aria-label="Toggle microphone"
            className={`p-3.5 rounded-full shadow-lg backdrop-blur-md transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button 
            onClick={toggleCamera}
            aria-label="Toggle camera"
            className={`p-3.5 rounded-full shadow-lg backdrop-blur-md transition-colors ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isCameraOff ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
          </button>

          <button 
            onClick={handleEndCall}
            aria-label="End call"
            className="p-3.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 px-8 flex items-center gap-2 transition-all hover:scale-105"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="font-medium hidden sm:inline">End Call</span>
          </button>

          <button 
            onClick={() => setShowChat(!showChat)}
            aria-label="Toggle chat"
            className={`p-3.5 rounded-full shadow-lg backdrop-blur-md flex transition-colors ${showChat ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20'}`}
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div 
        className={`absolute inset-y-0 right-0 w-80 bg-surface border-l border-white/10 transform transition-transform duration-300 flex flex-col z-40 ${showChat ? 'translate-x-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h3 className="font-medium">In-call Messages</h3>
        </div>
        <div className="flex-grow p-4 flex flex-col justify-end">
          <p className="text-center text-sm text-white/40">No messages yet.</p>
        </div>
        <div className="p-4 border-t border-white/10">
          <input 
            type="text" 
            placeholder="Type a message..." 
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
};
