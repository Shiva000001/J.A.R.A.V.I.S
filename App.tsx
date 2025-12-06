
import React, { useState, useEffect } from 'react';
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
    return localStorage.getItem('jarvis_username') || 'SHIVA SOORYAVANSHI';
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

  const isListening = status !== AssistantStatus.IDLE;

  // JARVIS Theme Colors
  const borderColor = isListening ? 'border-cyan-500' : 'border-zinc-700';
  const textColor = isListening ? 'text-cyan-400' : 'text-zinc-500';

  if (!isAuthenticated) {
      return <SecurityScreen onUnlock={() => setIsAuthenticated(true)} userName={userName} />;
  }

  return (
    <div className="bg-black text-white h-screen w-full flex flex-col relative overflow-hidden font-mono">
      {/* HUD Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Top Bar HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex flex-col">
          <h1 className={`text-xl font-bold tracking-widest ${textColor} transition-colors duration-500`}>J.A.R.V.I.S.</h1>
          <span className="text-xs text-zinc-600">JUST A RATHER VERY INTELLIGENT SYSTEM</span>
        </div>
        <div className="flex flex-col items-end">
            <div className="flex space-x-2 mb-2">
                <div className={`h-2 w-16 ${isListening ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-800'}`}></div>
                <div className={`h-2 w-8 ${isListening ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-800'}`} style={{animationDelay: '0.2s'}}></div>
                <div className={`h-2 w-4 ${isListening ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-800'}`} style={{animationDelay: '0.4s'}}></div>
            </div>
            <div className="text-[10px] text-cyan-600 tracking-widest uppercase bg-cyan-900/10 px-2 py-1 border border-cyan-900/30 rounded">
                AUTH: {userName}
            </div>
        </div>
      </div>

      {/* Main Visualizer Area */}
      <main className="relative flex-grow flex items-center justify-center z-10">
        <Visualizer analyserNode={analyserNode} emotion={emotion} />
      </main>

      {/* Camera Feed */}
      <div className="absolute top-16 right-4 z-20 pointer-events-auto">
          <CameraFeed stream={videoStream} isCameraOn={isCameraOn} />
      </div>

      {/* Transcript Log (Left Side) */}
      <div className="absolute top-24 left-4 z-20 w-80 pointer-events-auto">
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
      <footer className="w-full flex flex-col items-center pb-8 pt-4 z-30 bg-gradient-to-t from-black via-black/80 to-transparent">
        <StatusIndicator status={status} />
        
        <div className="flex justify-center items-center space-x-6 mt-6">
          <button
            onClick={stop}
            className={`group p-4 rounded-full border border-red-500/50 bg-red-900/20 hover:bg-red-500/40 transition-all duration-300 backdrop-blur-md ${isListening ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
            aria-label="Stop"
          >
            <CloseIcon className="w-6 h-6 text-red-200 group-hover:text-white" />
          </button>
          
          <button
            onClick={start}
            className={`group relative p-6 rounded-full border-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              ${isListening 
                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]' 
                : 'bg-zinc-800 border-zinc-600 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'}`}
            disabled={isListening}
            aria-label="Start"
          >
            <MicIcon className={`w-8 h-8 transition-colors ${isListening ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-cyan-300'}`} />
            {!isListening && <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">INITIATE</span>}
          </button>

          <button
            onClick={toggleCamera}
            className={`group p-4 rounded-full border transition-all duration-300 backdrop-blur-md
              ${isCameraOn 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' 
                : 'bg-zinc-900/50 border-zinc-700 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-300'}`}
            disabled={!isListening}
            aria-label="Toggle Camera"
          >
            {isCameraOn ? <CameraOffIcon className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
          </button>

          <button
             onClick={clearTranscript}
             className="p-4 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-white/50 transition-all duration-300 backdrop-blur-md"
             disabled={isListening || transcript.length === 0}
             aria-label="Clear Transcript"
          >
             <TrashIcon className="w-6 h-6" />
          </button>

          <button
             onClick={() => setShowProfile(true)}
             className="p-4 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all duration-300 backdrop-blur-md"
             aria-label="User Profile"
          >
             <UserIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-8 text-[10px] text-cyan-500/60 font-mono tracking-[0.2em] uppercase">
            Made by Shiva Sooryavanshi
        </div>
      </footer>
      
      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-cyan-500/30 rounded-tl-3xl pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-cyan-500/30 rounded-tr-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-cyan-500/30 rounded-bl-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-cyan-500/30 rounded-br-3xl pointer-events-none"></div>
    </div>
  );
};

export default App;
