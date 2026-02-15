
import React, { useEffect, useRef } from 'react';

interface TranscriptEntry {
  speaker: 'user' | 'model';
  text: string;
}

interface TranscriptDisplayProps {
  transcript: TranscriptEntry[];
  interimText: string | null;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ transcript, interimText }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  return (
    <div className="w-full h-80 bg-black/40 border border-cyan-500/20 rounded-lg backdrop-blur-md p-4 flex flex-col font-mono shadow-2xl">
      <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {transcript.length === 0 && !interimText && (
            <div className="h-full flex items-center justify-center">
                <p className="text-zinc-700 text-[10px] tracking-widest text-center uppercase">System logs empty...<br/>Waiting for uplink</p>
            </div>
        )}
        
        {transcript.map((entry, index) => (
          <div key={index} className="animate-in fade-in slide-in-from-left-2 duration-300">
            <span className={`text-[10px] font-bold ${entry.speaker === 'user' ? 'text-zinc-500' : 'text-cyan-600'}`}>
              {entry.speaker === 'user' ? '>> USER_INPUT' : '<< JARVIS_LOG'}
            </span>
            <p className={`text-sm mt-0.5 ${entry.speaker === 'user' ? 'text-zinc-300' : 'text-cyan-400'}`}>
              {entry.text}
            </p>
          </div>
        ))}
        
        {interimText && (
          <div className="animate-pulse">
            <p className="text-[10px] text-cyan-500/50 italic uppercase tracking-widest">Processing_Stream...</p>
            <p className="text-sm text-cyan-500/70 italic border-l-2 border-cyan-500/20 pl-2">
              {interimText}
            </p>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}} />
    </div>
  );
};

export default TranscriptDisplay;
