// FILE: src/components/Watchtower.js
import React from 'react';
import WarRoomConsole from './WarRoomConsole';

const Watchtower = () => {
  return (
    <div className="w-full h-screen bg-[#0a0a0a] overflow-hidden">
      <div className="w-full h-full max-w-6xl mx-auto border-x border-amber-900/20 shadow-2xl">
        <WarRoomConsole />
      </div>
    </div>
  );
};

export default Watchtower;
