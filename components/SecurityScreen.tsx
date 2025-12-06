
import React, { useEffect, useRef, useState } from 'react';

interface SecurityScreenProps {
  onUnlock: () => void;
  userName: string;
}

const SecurityScreen: React.FC<SecurityScreenProps> = ({ onUnlock, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('INITIALIZING'); // INITIALIZING, SCANNING, VERIFIED, DENIED
  const [scanLinePos, setScanLinePos] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus('SCANNING');
        
        // Simulate scanning duration and verification
        setTimeout(() => {
            setStatus('VERIFIED');
            setTimeout(() => {
                // Cleanup and unlock
                if(stream) stream.getTracks().forEach(t => t.stop());
                onUnlock();
            }, 2000);
        }, 3500);

      } catch (err) {
        console.error("Camera access denied", err);
        setStatus('DENIED');
      }
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [onUnlock]);

  // Scanning animation loop
  useEffect(() => {
      if (status === 'SCANNING') {
          const interval = setInterval(() => {
              setScanLinePos(prev => (prev + 1) % 100);
          }, 15);
          return () => clearInterval(interval);
      }
  }, [status]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-mono text-cyan-500 overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>
        
        <div className="relative z-10 w-full max-w-md aspect-[3/4] border-2 border-cyan-900 bg-black/50 backdrop-blur-sm rounded-3xl overflow-hidden flex flex-col items-center shadow-[0_0_50px_rgba(8,145,178,0.3)]">
            
            {/* Camera View */}
            <div className="absolute inset-0 bg-zinc-900">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100 opacity-60 mix-blend-screen" />
            </div>

            {/* Overlays */}
            <div className="absolute inset-0 pointer-events-none">
                 {/* Face Target Box */}
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border border-cyan-500/30 rounded-[3rem] box-border overflow-hidden">
                     {/* Corners */}
                     <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-cyan-500/50"></div>
                     <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-32 h-1 bg-cyan-500/50"></div>
                     
                     {/* Scanning Line */}
                     {status === 'SCANNING' && (
                         <div className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,1)]"
                              style={{ top: `${scanLinePos}%` }}
                         />
                     )}
                     
                     {/* Grid Overlay inside face box */}
                     <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,255,255,1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                     ></div>
                 </div>
                 
                 {/* Rotating Rings */}
                 <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] border border-dashed border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite]`}></div>
                 <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] border border-dotted border-cyan-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]`}></div>
                 
                 {/* Data Points */}
                 <div className="absolute top-20 right-10 text-[10px] text-cyan-500/70 flex flex-col items-end">
                    <span className="animate-pulse">ISO: 400</span>
                    <span>APERTURE: F/1.8</span>
                    <span>WB: AUTO</span>
                 </div>
            </div>

            {/* HUD Text */}
            <div className="absolute bottom-10 w-full text-center z-20">
                 <h2 className="text-xl font-bold tracking-[0.3em] mb-4 text-white drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">SECURITY CHECK</h2>
                 
                 {status === 'INITIALIZING' && <p className="text-sm animate-pulse text-cyan-400">INITIALIZING OPTICAL SENSORS...</p>}
                 
                 {status === 'SCANNING' && (
                     <div className="flex flex-col items-center space-y-1">
                        <p className="text-sm font-semibold animate-pulse text-cyan-300">ANALYZING BIOMETRICS...</p>
                        <p className="text-[10px] text-cyan-600 tracking-widest">MATCHING DATABASE PATTERNS</p>
                        <div className="w-48 h-1 bg-gray-800 rounded mt-2 overflow-hidden">
                            <div className="h-full bg-cyan-500 animate-[width_3s_ease-in-out_infinite]" style={{width: '100%'}}></div>
                        </div>
                     </div>
                 )}
                 
                 {status === 'VERIFIED' && (
                     <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-green-500 flex items-center justify-center mb-2 bg-green-500/20 text-green-500">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                             </svg>
                        </div>
                        <p className="text-lg font-bold text-green-400 animate-bounce tracking-widest">IDENTITY CONFIRMED</p>
                        <p className="text-xs text-green-300 mt-2 uppercase tracking-[0.2em]">WELCOME, {userName.toUpperCase()}</p>
                     </div>
                 )}
                 
                 {status === 'DENIED' && (
                     <div className="flex flex-col items-center">
                        <p className="text-red-500 font-bold text-xl tracking-widest animate-pulse">ACCESS DENIED</p>
                        <p className="text-xs text-red-400 mt-1">BIOMETRIC MISMATCH</p>
                     </div>
                 )}
            </div>
        </div>
        
        {/* Override (simulated fallback) */}
        {status === 'DENIED' && (
            <button 
                onClick={onUnlock}
                className="mt-8 px-8 py-3 border border-red-500 text-red-500 rounded hover:bg-red-500/10 transition-colors uppercase tracking-widest text-sm"
            >
                Override Security Protocol
            </button>
        )}
        
        <div className="absolute bottom-4 text-[10px] text-cyan-900 font-mono">
            STARK INDUSTRIES SECURE LOGIN V.8.0.1
        </div>
    </div>
  );
};

export default SecurityScreen;
