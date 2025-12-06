import React, { useRef, useEffect } from 'react';

interface CameraFeedProps {
  stream: MediaStream | null;
  isCameraOn: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ stream, isCameraOn }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return (
    <div 
      className={`absolute top-4 right-4 w-64 h-48 bg-zinc-800 rounded-xl overflow-hidden shadow-lg border-2 border-zinc-700/50 transition-all duration-500 ease-in-out ${isCameraOn ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="w-full h-full object-cover transform -scale-x-100" // Flip for mirror effect
      />
    </div>
  );
};

export default CameraFeed;
