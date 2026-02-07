// FILE: src/components/Watchtower.js
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient'; 

const Watchtower = () => {
  const [history, setHistory] = useState([]); 
  const [input, setInput] = useState('');      
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState('ACTIVE'); 
  const [progress, setProgress] = useState(0); 
  const [currentStep, setCurrentStep] = useState(1);
  const scrollRef = useRef(null);

  useEffect(() => {
    const initStrategy = async () => {
      if (history.length === 0) {
        await processMessage(" [SYSTEM_INIT_STRATEGY] ", true);
      }
    };
    initStrategy();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isThinking]);

  const processMessage = async (text, isHidden = false) => {
    if (!text.trim()) return;
    if (!isHidden) setHistory(prev => [...prev, { role: 'user', content: text }]);
    setInput('');       
    setIsThinking(true); 

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session invalid.");

      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/watchtower-brain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: history.filter(m => m.role !== 'system')
        }),
      });

      if (!response.ok) throw new Error(`Strategy Connection Failed`);
      const data = await response.json();

      if (data.message) setHistory(prev => [...prev, { role: 'assistant', content: data.message }]);
      if (data.percentage_complete) setProgress(data.percentage_complete);
      if (data.current_step_number) setCurrentStep(data.current_step_number);
      if (data.status === 'COMPLETE') setStatus('COMPLETE');

    } catch (error) {
      console.error("Watchtower Error:", error);
      setHistory(prev => [...prev, { role: 'assistant', content: "Tactical disconnect. Re-establishing link..." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-amber-500 font-mono max-w-6xl mx-auto border-x border-amber-900/30">
      <div className="flex flex-col p-4 border-b border-amber-900/50 bg-black sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs tracking-widest uppercase text-amber-700">BIQc // WATCHTOWER // STEP {currentStep}</span>
          <span className="text-xs text-amber-700">{progress}% COMPLETE</span>
        </div>
        <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
           <div className="h-full bg-amber-600 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 border ${msg.role === 'user' ? 'border-amber-700/50 bg-amber-900/10 text-amber-100' : 'border-gray-800 bg-black text-amber-500'} rounded-sm shadow-sm`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && <div className="flex justify-start"><span className="text-xs animate-pulse text-amber-800">... CALCULATING STRATEGY ...</span></div>}
        <div ref={scrollRef} />
      </div>
      <div className="p-4 bg-black border-t border-amber-900/30">
        <div className="flex items-center gap-2 border border-amber-900/50 p-2">
          <span className="text-amber-700">{'>'}</span>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !isThinking && processMessage(input)} placeholder="ENTER TACTICAL DATA..." className="flex-1 bg-transparent text-amber-100 focus:outline-none placeholder-amber-900/50" autoFocus />
        </div>
      </div>
    </div>
  );
};
export default Watchtower;
