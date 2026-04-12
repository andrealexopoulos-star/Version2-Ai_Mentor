import React, { useState } from 'react';
import { CognitiveLoadingScreen } from '../components/CognitiveLoadingScreen';

const LoadingPreview = () => {
  const [mode, setMode] = useState('first');
  const [key, setKey] = useState(0);

  const reload = (m) => {
    setMode(m);
    setKey(k => k + 1); // Force remount for new random content
  };

  return (
    <div>
      {/* Controls */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => reload('first')} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#E85D00' }}>First Visit</button>
        <button onClick={() => reload('returning')} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#7C3AED' }}>Returning</button>
        <button onClick={() => reload(mode)} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#3B82F6' }}>Randomise</button>
      </div>
      <CognitiveLoadingScreen key={key} mode={mode} ownerName="Andre" />
    </div>
  );
};

export default LoadingPreview;
