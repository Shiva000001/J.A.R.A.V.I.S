
import React, { useState } from 'react';
import { useJarvis } from './hooks/useJarvis';
import { AssistantStatus, Emotion } from './types';
import Visualizer from './components/Visualizer';
import { MicIcon } from './components/icons/MicIcon';
import { CloseIcon } from './components/icons/CloseIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { CameraOffIcon } from './components/icons/CameraOffIcon';
import { UserIcon } from './components/icons/UserIcon';
import StatusIndicator from './components/StatusIndicator';
import TranscriptDisplay from './components/TranscriptDisplay';
import CameraFeed from './components/CameraFeed';
import SecurityScreen from './components/SecurityScreen';
import UserProfile from './components/UserProfile';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('jarvis_username') || 'AUTHORIZED USER';
  });

  const {
    status,
    start,
    stop,
    analyserNode,
    transcript,
    interimText,
    emotion,
    clearTranscript,
    isCameraOn,
    toggleCamera,
    videoStream,
  } = useJarvis();

  const handleSaveProfile = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('jarvis_username', newName);
    setShowProfile(false);
  };

  // Button logic: Enabled if IDLE or ERROR. Disabled if CONNECTING, LISTENING, etc.
  const isConnecting = status === AssistantStatus.CONNECTING;
  const isRunning = [AssistantStatus.LISTENING, AssistantStatus.THINKING, AssistantStatus.SPEAKING].includes(status);
  const isError = status === AssistantStatus.ERROR;
  const canStart = status === AssistantStatus.IDLE || isError;

  const textColor = isRunning ? 'text-cyan-400' : 'text-zinc-500';

  if (!isAuthenticated) {
      return <SecurityScreen onUnlock={() => setIsAuthenticated(true)} userName={userName} />;
  }

  return (
    <div className="bg-black text-white h-screen w-full flex flex-col relative overflow-hidden font-mono select-none">
      {/* HUD Background Grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.2) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      </div>

      {/* Top Bar HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_cyan]' : 'bg-zinc-700'}`}></div>
            <h1 className={`text-2xl font-black tracking-[0.2em] ${textColor} transition-colors duration-500`}>J.A.R.V.I.S.</h1>
          </div>
          <span className="text-[9px] text-zinc-600 tracking-widest mt-1">MARK-XVIII // GLOBAL_ACCESS_PROTOCOL</span>
        </div>
        
        <div className="flex flex-col items-end space-y-2">
            <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-1 w-8 ${isRunning ? 'bg-cyan-500' : 'bg-zinc-800'} transition-colors`} style={{ opacity: isRunning ? 0.2 + (i * 0.2) : 1 }}></div>
                ))}
            </div>
            <div className="text-[10px] text-cyan-500/80 tracking-widest uppercase border border-cyan-500/20 px-3 py-1 bg-cyan-500/5 backdrop-blur-md rounded-sm">
                PROTOCOL: <span className="text-white font-bold">{userName.toUpperCase()}</span>
            </div>
            <div className="text-[9px] text-zinc-500 flex space-x-4">
                <span>LAT: 37.7749° N</span>
                <span>LON: 122.4194° W</span>
            </div>
        </div>
      </div>

      {/* Main Visualizer Area */}
      <main className="relative flex-grow flex items-center justify-center z-10">
        <Visualizer analyserNode={analyserNode} emotion={emotion} />
        
        {/* Decorative HUD Circles around visualizer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-[600px] h-[600px] border border-cyan-500/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
            <div className="w-[620px] h-[620px] border border-dashed border-cyan-500/10 rounded-full animate-[spin_30s_linear_infinite_reverse]"></div>
        </div>
      </main>

      {/* System Stats HUD (Right) */}
      <div className="absolute right-6 top-32 z-20 w-48 space-y-4 pointer-events-none opacity-60">
          <div className="border-r-2 border-cyan-500/40 pr-3 py-1 text-right">
              <div className="text-[10px] text-cyan-600">CORE TEMPERATURE</div>
              <div className="text-sm font-bold text-white">32.4° C</div>
          </div>
          <div className="border-r-2 border-cyan-500/40 pr-3 py-1 text-right">
              <div className="text-[10px] text-cyan-600">NETWORK LATENCY</div>
              <div className="text-sm font-bold text-white">12ms</div>
          </div>
          <div className="border-r-2 border-cyan-500/40 pr-3 py-1 text-right">
              <div className="text-[10px] text-cyan-600">G-SEARCH UPLINK</div>
              <div className={`text-sm font-bold ${isRunning ? 'text-green-400' : 'text-zinc-600'}`}>{isRunning ? 'CONNECTED' : 'STANDBY'}</div>
          </div>
      </div>

      {/* Camera Feed */}
      <div className="absolute top-20 right-6 z-20 pointer-events-auto">
          <CameraFeed stream={videoStream} isCameraOn={isCameraOn} />
      </div>

      {/* Transcript Log (Left Side) */}
      <div className="absolute top-24 left-6 z-20 w-80 pointer-events-auto">
         <TranscriptDisplay transcript={transcript} interimText={interimText} />
      </div>

      {/* User Profile Modal */}
      {showProfile && (
          <UserProfile 
            currentName={userName} 
            onSave={handleSaveProfile} 
            onClose={() => setShowProfile(false)} 
          />
      )}

      {/* Bottom Controls */}
      <footer className="w-full flex flex-col items-center pb-10 pt-4 z-30 bg-gradient-to-t from-black via-black/90 to-transparent">
        <StatusIndicator status={status} />
        
        <div className="flex justify-center items-center space-x-8 mt-8">
          <button
            onClick={stop}
            className={`group p-4 rounded-full border border-red-500/50 bg-red-900/10 hover:bg-red-500/30 transition-all duration-300 backdrop-blur-xl ${isRunning || isConnecting ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
            aria-label="Terminate"
          >
            <CloseIcon className="w-6 h-6 text-red-400 group-hover:text-white" />
          </button>
          
          <button
            onClick={start}
            disabled={!canStart || isConnecting}
            className={`group relative p-8 rounded-full border-2 transition-all duration-500 
              ${isRunning 
                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)]' 
                : isError
                ? 'bg-red-900/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                : 'bg-zinc-900/50 border-zinc-700 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]'}`}
            aria-label="Initialize"
          >
            <div className={`absolute inset-0 rounded-full border border-cyan-500/20 ${isRunning ? 'animate-ping' : ''}`}></div>
            <MicIcon className={`w-10 h-10 transition-colors ${isRunning ? 'text-cyan-400' : isError ? 'text-red-400' : 'text-zinc-500 group-hover:text-cyan-400'}`} />
            {canStart && !isConnecting && (
              <span className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 text-[10px] tracking-[0.3em] text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
                {isError ? 'REBOOT SYSTEM' : 'INITIALIZE'}
              </span>
            )}
            {isConnecting && (
               <span className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 text-[10px] tracking-[0.3em] text-cyan-500 animate-pulse whitespace-nowrap font-bold">
                 HANDSHAKING...
               </span>
            )}
          </button>

          <button
            onClick={toggleCamera}
            disabled={!isRunning}
            className={`group p-4 rounded-full border transition-all duration-300 backdrop-blur-xl
              ${isCameraOn 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' 
                : 'bg-zinc-900/50 border-zinc-700 text-zinc-500 hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-30'}`}
            aria-label="Toggle Optics"
          >
            {isCameraOn ? <CameraOffIcon className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
          </button>

          <button
             onClick={clearTranscript}
             className="p-4 rounded-full border border-zinc-800 bg-zinc-900/30 text-zinc-600 hover:text-red-400 hover:border-red-500/30 transition-all duration-300 backdrop-blur-xl"
             disabled={isRunning || transcript.length === 0}
             aria-label="Purge Logs"
          >
             <TrashIcon className="w-6 h-6" />
          </button>

          <button
             onClick={() => setShowProfile(true)}
             className="p-4 rounded-full border border-zinc-800 bg-zinc-900/30 text-zinc-600 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300 backdrop-blur-xl"
             aria-label="Personnel Data"
          >
             <UserIcon className="w-6 h-6" />
          </button>
        </div>
      </footer>
      
      {/* Decorative HUD Corners */}
      <div className="absolute top-0 left-0 w-48 h-48 border-l-[1px] border-t-[1px] border-cyan-500/20 rounded-tl-[4rem] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-48 h-48 border-r-[1px] border-t-[1px] border-cyan-500/20 rounded-tr-[4rem] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 border-l-[1px] border-b-[1px] border-cyan-500/20 rounded-bl-[4rem] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-48 h-48 border-r-[1px] border-b-[1px] border-cyan-500/20 rounded-br-[4rem] pointer-events-none"></div>

      {/* Scanning Bar Animation Overlay */}
      {isRunning && (
          <div className="absolute left-0 w-full h-[2px] bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.3)] z-0 animate-[scan_8s_ease-in-out_infinite]"></div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}} />
    </div>
  );
};

export default App;
