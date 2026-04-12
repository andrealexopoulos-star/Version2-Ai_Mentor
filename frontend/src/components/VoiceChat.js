import { getBackendUrl } from '../config/urls';
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { 
  Mic, MicOff, Phone, PhoneOff, Video, VideoOff, 
  MessageSquare, Volume2, VolumeX
} from 'lucide-react';

const AI_ADVISOR_IMAGE = "/advisor-avatar.png";
const ADVISORY_MEMO_KEY = 'biqc_advisory_memos';
const MAX_MEMOS = 20;

const extractActionItems = (items) => {
  const lines = (items || [])
    .map((entry) => String(entry?.text || '').trim())
    .filter(Boolean);
  const actionLines = lines
    .filter((line) => /(?:\bmust\b|\bshould\b|\baction\b|\bnext\b|\bowner\b|\bby\b|\bdeadline\b|\bdecide\b|\bexecute\b)/i.test(line))
    .slice(0, 5);
  return actionLines.length ? actionLines : lines.slice(0, 3);
};

const buildMemoFromTranscript = (transcriptItems, durationSec) => {
  const actionItems = extractActionItems(transcriptItems);
  const summary = transcriptItems
    .slice(-6)
    .map((entry) => `${entry.role === 'agent' ? 'Advisor' : 'Owner'}: ${entry.text}`)
    .join(' ')
    .slice(0, 900);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    title: 'Strategic Advisor Memo',
    duration_seconds: durationSec || 0,
    summary: summary || 'Session captured. Review transcript and assign owners.',
    action_items: actionItems,
    transcript: transcriptItems,
  };
};

const VoiceChat = ({ onClose, onSwitchToText }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const audioElementRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const callTimerRef = useRef(null);

  const API_BASE = getBackendUrl() || '';

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize WebRTC connection with OpenAI Realtime API
  const initializeWebRTC = async () => {
    try {
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';
      
      const tokenResponse = await fetch(`${API_BASE}/api/voice/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      if (!tokenResponse.ok) {
        throw new Error("Failed to get session token");
      }
      
      const data = await tokenResponse.json();
      if (!data.client_secret?.value) {
        throw new Error("Invalid session response");
      }

      // Create WebRTC peer connection
      peerConnectionRef.current = new RTCPeerConnection();

      // Set up audio element for receiving AI voice
      audioElementRef.current = document.createElement("audio");
      audioElementRef.current.autoplay = true;
      document.body.appendChild(audioElementRef.current);

      peerConnectionRef.current.ontrack = (event) => {
        audioElementRef.current.srcObject = event.streams[0];
        audioElementRef.current.muted = !isSpeakerOn;
        audioElementRef.current.volume = isSpeakerOn ? 1 : 0;
        setIsAgentSpeaking(true);
        setTimeout(() => setIsAgentSpeaking(false), 500);
      };

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      
      // Display video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Add audio tracks to peer connection
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Set up audio analysis for user speaking detection
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up data channel for events
      dataChannelRef.current = peerConnectionRef.current.createDataChannel("oai-events");
      dataChannelRef.current.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          handleRealtimeEvent(eventData);
        } catch (e) {
          // console.log("Received event:", event.data);
        }
      };

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      // Send offer to backend and get answer
      const negotiateResponse = await fetch(`${API_BASE}/api/voice/realtime/negotiate`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "application/sdp",
          "Authorization": `Bearer ${authToken}`
        }
      });

      if (!negotiateResponse.ok) {
        throw new Error("Failed to negotiate WebRTC connection");
      }

      const { sdp: answerSdp } = await negotiateResponse.json();
      const answer = {
        type: "answer",
        sdp: answerSdp
      };

      await peerConnectionRef.current.setRemoteDescription(answer);
      
      return true;
    } catch (err) {
      console.error("WebRTC initialization failed:", err);
      throw err;
    }
  };

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = (event) => {
    // console.log("Realtime event:", event);
    
    if (event.type === "response.audio.delta") {
      setIsAgentSpeaking(true);
    } else if (event.type === "response.audio.done") {
      setIsAgentSpeaking(false);
    } else if (event.type === "conversation.item.created") {
      if (event.item?.content?.[0]?.text) {
        setTranscript(prev => [...prev, {
          role: event.item.role === "assistant" ? "agent" : "user",
          text: event.item.content[0].text,
          time: new Date()
        }]);
      }
    } else if (event.type === "input_audio_buffer.speech_started") {
      setIsUserSpeaking(true);
    } else if (event.type === "input_audio_buffer.speech_stopped") {
      setIsUserSpeaking(false);
    }
  };

  // Start call
  const startCall = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await initializeWebRTC();
      
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevels();
      
      // Add initial greeting to transcript
      setTranscript([{
        role: 'agent',
        text: 'Good to see you. I am your strategic advisor for this session. Tell me the decision we need to tighten this week.',
        time: new Date()
      }]);
      
    } catch (err) {
      console.error('Failed to start call:', err);
      setIsConnecting(false);
      setError(err.message || 'Failed to connect. Please try again.');
    }
  };

  // Monitor audio levels for speaking detection
  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current || !isConnected) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkAudio = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      setIsUserSpeaking(average > 30 && !isMuted);
      
      if (isConnected) {
        requestAnimationFrame(checkAudio);
      }
    };
    
    checkAudio();
  }, [isConnected, isMuted]);

  // End call
  const endCall = () => {
    if (transcript.length > 0) {
      const memo = buildMemoFromTranscript(transcript, callDuration);
      try {
        const existing = JSON.parse(localStorage.getItem(ADVISORY_MEMO_KEY) || '[]');
        const next = [memo, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_MEMOS);
        localStorage.setItem(ADVISORY_MEMO_KEY, JSON.stringify(next));
      } catch {}
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Remove audio element
    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    setIsConnected(false);
    setCallDuration(0);
    setTranscript([]);
    onClose?.();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn;
      });
    }
    setIsVideoOn(!isVideoOn);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  useEffect(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.muted = !isSpeakerOn;
    audioElementRef.current.volume = isSpeakerOn ? 1 : 0;
  }, [isSpeakerOn]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-[#16162a]">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-white/80 text-xs sm:text-sm">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : error ? 'Error' : 'Ready'}
            </span>
          </div>
          {isConnected && (
            <span className="text-white/60 text-xs sm:text-sm font-mono">{formatDuration(callDuration)}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-2 rounded-lg transition-colors ${showTranscript ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white/80" />
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Agent Video (Main) */}
        <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a]">
          {/* Agent Image with animations */}
          <div className="relative">
            {/* Speaking indicator ring */}
            <div 
              className={`absolute inset-0 rounded-full transition-all duration-300 ${
                isAgentSpeaking 
                  ? 'ring-4 ring-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.5)]' 
                  : ''
              }`}
              style={{ 
                transform: isAgentSpeaking ? 'scale(1.02)' : 'scale(1)',
                animation: isAgentSpeaking ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }}
            />
            
            {/* Agent portrait */}
            <div 
              className="w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl relative"
              style={{
                animation: isConnected ? 'subtle-breathe 4s ease-in-out infinite' : 'none'
              }}
            >
              <img 
                src={AI_ADVISOR_IMAGE}
                alt="AI Advisor"
                className="w-full h-full object-cover"
                style={{
                  filter: isConnected ? 'none' : 'grayscale(50%)',
                  transition: 'filter 0.5s ease'
                }}
              />
              
              {/* Overlay for visual effects */}
              {isAgentSpeaking && (
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent animate-pulse" />
              )}
            </div>
            
            {/* Name tag */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <p className="text-white font-medium text-center text-sm sm:text-base">Strategic Advisor</p>
              <p className="text-white/60 text-xs text-center">Ask BIQc</p>
            </div>
            
            {/* Audio visualizer when speaking */}
            {isAgentSpeaking && (
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8">
                {[8, 14, 22, 14, 8].map((baseHeight, i) => (
                  <div 
                    key={i}
                    className="w-1 bg-blue-500 rounded-full"
                    style={{
                      height: `${baseHeight + (isAgentSpeaking ? 6 : 0)}px`,
                      animation: `audio-bar 0.5s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Connecting overlay */}
          {isConnecting && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center px-4">
                <span className="text-sm text-[#E85D00] block mx-auto mb-4" style={{ fontFamily: "monospace" }}>connecting...</span>
                <p className="text-white text-base sm:text-lg">Connecting to your advisor...</p>
                <p className="text-white/60 text-xs sm:text-sm mt-2">Setting up secure voice channel</p>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {error && !isConnecting && !isConnected && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <PhoneOff className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
                </div>
                <h2 className="text-white text-lg sm:text-xl font-semibold mb-2">Connection Failed</h2>
                <p className="text-white/60 text-sm mb-4 max-w-xs mx-auto">{error}</p>
                <Button 
                  onClick={() => { setError(null); startCall(); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
          
          {/* Pre-call state */}
          {!isConnected && !isConnecting && !error && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-white/20 mx-auto mb-4 sm:mb-6">
                  <img src={AI_ADVISOR_IMAGE} alt="Advisor" className="w-full h-full object-cover grayscale" />
                </div>
                <h2 className="text-white text-xl sm:text-2xl font-semibold mb-2">Advisor session ready</h2>
                <p className="text-white/60 text-sm sm:text-base mb-4 sm:mb-6">Start a strategic call and capture practical next actions</p>
                <Button 
                  onClick={startCall}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Start Call
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* User Video (Picture-in-Picture) */}
        <div className="absolute bottom-20 sm:bottom-24 right-3 sm:right-6 w-28 h-20 sm:w-48 sm:h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl bg-[#1a1a2e]">
          {isVideoOn ? (
            <video 
              ref={videoRef}
              autoPlay 
              muted 
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <VideoOff className="w-6 h-6 sm:w-8 sm:h-8 text-white/40" />
            </div>
          )}
          
          {/* User speaking indicator */}
          {isUserSpeaking && !isMuted && (
            <div className="absolute inset-0 ring-2 ring-green-500 rounded-xl" />
          )}
          
          {/* Muted indicator */}
          {isMuted && (
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-red-500 p-0.5 sm:p-1 rounded-full">
              <MicOff className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
            </div>
          )}
          
          <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 bg-black/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs text-white">
            You
          </div>
        </div>

        {/* Transcript Panel */}
        {showTranscript && (
          <div className="absolute top-0 right-0 w-full sm:w-80 h-full bg-[#16162a]/95 backdrop-blur-sm border-l border-white/10 p-3 sm:p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm sm:text-base">Transcript</h3>
              <button 
                onClick={() => setShowTranscript(false)}
                className="sm:hidden p-1 rounded hover:bg-white/10"
              >
                <span className="text-white/60 text-xs">Close</span>
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {transcript.map((item, idx) => (
                <div key={idx} className={`${item.role === 'agent' ? 'text-blue-300' : 'text-green-300'}`}>
                  <p className="text-xs text-white/40 mb-1">
                    {item.role === 'agent' ? 'Advisor' : 'You'}
                  </p>
                  <p className="text-xs sm:text-sm text-white/80">{item.text}</p>
                </div>
              ))}
              {transcript.length === 0 && (
                <p className="text-white/40 text-xs sm:text-sm">Conversation transcript will appear here...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#16162a] px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          </button>
          
          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${
              !isVideoOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isVideoOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          </button>
          
          {/* End Call */}
          <button
            onClick={endCall}
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          
          {/* Speaker Toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            disabled={!isConnected}
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          </button>
          
          {/* Switch to Text Chat */}
          <button
            onClick={onSwitchToText}
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            title="Switch to text chat"
          >
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>
        
        {/* Helper text */}
        <p className="text-center text-white/40 text-xs mt-2 sm:mt-3">
          {isConnected 
            ? isMuted ? 'You are muted' : 'Speak naturally - your advisor is listening'
            : 'Click "Start Call" to begin your voice session'
          }
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes subtle-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
        
        @keyframes audio-bar {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default VoiceChat;
