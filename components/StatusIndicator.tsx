
import React from 'react';
import { AssistantStatus } from '../types';

interface StatusIndicatorProps {
  status: AssistantStatus;
}

const statusMap: Record<AssistantStatus, { text: string; className: string }> = {
  [AssistantStatus.IDLE]: { text: 'SYSTEM STANDBY', className: 'text-zinc-600' },
  [AssistantStatus.CONNECTING]: { text: 'ESTABLISHING SECURE UPLINK...', className: 'text-cyan-500 animate-pulse' },
  [AssistantStatus.LISTENING]: { text: 'AWAITING USER COMMAND', className: 'text-cyan-400' },
  [AssistantStatus.THINKING]: { text: 'PROCESSING DATA...', className: 'text-sky-400 animate-pulse' },
  [AssistantStatus.SPEAKING]: { text: 'TRANSMITTING OUTPUT', className: 'text-teal-400' },
  [AssistantStatus.ERROR]: { text: 'SYSTEM FAILURE - REBOOT REQUIRED', className: 'text-red-500 font-black' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const { text, className } = statusMap[status];

  return (
    <div className="h-10 text-center px-4">
      <p className={`text-sm tracking-[0.4em] font-bold transition-all duration-300 uppercase ${className}`}>
        {text}
      </p>
    </div>
  );
};

export default StatusIndicator;
