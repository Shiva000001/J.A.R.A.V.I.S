
import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface UserProfileProps {
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ currentName, onSave, onClose }) => {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-zinc-900/90 border border-cyan-500/50 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)] relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-lg"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-cyan-500/50 rounded-br-lg"></div>
        
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-cyan-400 transition-colors"
        >
            <CloseIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-cyan-400 mb-6 tracking-widest text-center uppercase">Identity Configuration</h2>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
            <div className="space-y-2">
                <label htmlFor="username" className="text-xs text-cyan-600 uppercase tracking-widest ml-1">Authorized Personnel Name</label>
                <input
                    id="username"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border-b-2 border-zinc-700 focus:border-cyan-500 text-white px-4 py-3 outline-none transition-all font-mono text-lg placeholder-zinc-700"
                    placeholder="ENTER NAME"
                    autoFocus
                />
            </div>

            <button
                type="submit"
                className="w-full py-4 bg-cyan-900/30 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500 hover:text-black font-bold tracking-widest uppercase transition-all duration-300 rounded hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]"
            >
                Update Database
            </button>
        </form>
        
        <div className="mt-6 text-center">
            <p className="text-[10px] text-zinc-600 font-mono">STARK INDUSTRIES // PERSONNEL DATABASE V.2.4</p>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
