import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { 
  Mic, MicOff, Phone, PhoneOff, Video, VideoOff, 
  MessageSquare, Volume2, VolumeX, Settings, Maximize2,
  MoreVertical, Users, Share2
} from 'lucide-react';

const AI_ADVISOR_IMAGE = "https://static.prod-images.emergentagent.com/jobs/5219767c-4311-47f6-b565-a6e726053b1e/images/fcc3dc83d3d0889615ef75f160ec065f7afa5dc888a66578583456fa4bbe979a.png";

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
  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const callTimerRef = useRef(null);

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start call
  const startCall = async () => {
    setIsConnecting(true);
    
    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Set up audio analysis for user speaking detection
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevels();
      
      // Simulate agent greeting after connection
      setTimeout(() => {
        simulateAgentSpeaking("Hello! I'm ready to help you think through your business challenges. What's on your mind today?");
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start call:', error);
      setIsConnecting(false);
      alert('Could not access camera/microphone. Please check permissions.');
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

  // Simulate agent speaking (will be replaced with real TTS)
  const simulateAgentSpeaking = (text) => {
    setIsAgentSpeaking(true);
    setTranscript(prev => [...prev, { role: 'agent', text, time: new Date() }]);
    
    // Simulate speaking duration based on text length
    const duration = Math.max(2000, text.length * 50);
    setTimeout(() => {
      setIsAgentSpeaking(false);
    }, duration);
  };

  // End call
  const endCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
    setIsConnected(false);
    setCallDuration(0);
    onClose?.();
  };

  // Toggle mute
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn;
      });
    }
    setIsVideoOn(!isVideoOn);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Demo: Simulate occasional agent responses
  useEffect(() => {
    if (!isConnected) return;
    
    const demoInterval = setInterval(() => {
      if (isUserSpeaking && !isAgentSpeaking) {
        // User finished speaking, agent responds
        setTimeout(() => {
          const responses = [
            "That's an interesting point. Tell me more about what's driving that concern.",
            "I hear you. What would success look like in this situation?",
            "Let's break that down. What's the one thing that would make the biggest difference?",
            "That makes sense. Have you considered approaching it from a different angle?",
          ];
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          simulateAgentSpeaking(randomResponse);
        }, 1500);
      }
    }, 8000);
    
    return () => clearInterval(demoInterval);
  }, [isConnected, isUserSpeaking, isAgentSpeaking]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#16162a]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-white/80 text-sm">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Ready to connect'}
            </span>
          </div>
          {isConnected && (
            <span className="text-white/60 text-sm font-mono">{formatDuration(callDuration)}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-2 rounded-lg transition-colors ${showTranscript ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            <MessageSquare className="w-5 h-5 text-white/80" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/10">
            <Users className="w-5 h-5 text-white/80" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/10">
            <Maximize2 className="w-5 h-5 text-white/80" />
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
              className="w-80 h-80 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl relative"
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
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-white font-medium text-center">Strategy Advisor</p>
              <p className="text-white/60 text-xs text-center">MySoundBoard</p>
            </div>
            
            {/* Audio visualizer when speaking */}
            {isAgentSpeaking && (
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-1 bg-blue-500 rounded-full"
                    style={{
                      height: `${Math.random() * 24 + 8}px`,
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
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-lg">Connecting to your advisor...</p>
              </div>
            </div>
          )}
          
          {/* Pre-call state */}
          {!isConnected && !isConnecting && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 mx-auto mb-6">
                  <img src={AI_ADVISOR_IMAGE} alt="Advisor" className="w-full h-full object-cover grayscale" />
                </div>
                <h2 className="text-white text-2xl font-semibold mb-2">Ready to talk?</h2>
                <p className="text-white/60 mb-6">Start a voice session with your Strategy Advisor</p>
                <Button 
                  onClick={startCall}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full text-lg"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Start Call
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* User Video (Picture-in-Picture) */}
        <div className="absolute bottom-24 right-6 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl bg-[#1a1a2e]">
          {isVideoOn ? (
            <video 
              ref={videoRef}
              autoPlay 
              muted 
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <VideoOff className="w-8 h-8 text-white/40" />
            </div>
          )}
          
          {/* User speaking indicator */}
          {isUserSpeaking && !isMuted && (
            <div className="absolute inset-0 ring-2 ring-green-500 rounded-xl" />
          )}
          
          {/* Muted indicator */}
          {isMuted && (
            <div className="absolute top-2 right-2 bg-red-500 p-1 rounded-full">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
          
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            You
          </div>
        </div>

        {/* Transcript Panel */}
        {showTranscript && (
          <div className="absolute top-0 right-0 w-80 h-full bg-[#16162a]/95 backdrop-blur-sm border-l border-white/10 p-4 overflow-y-auto">
            <h3 className="text-white font-semibold mb-4">Transcript</h3>
            <div className="space-y-4">
              {transcript.map((item, idx) => (
                <div key={idx} className={`${item.role === 'agent' ? 'text-blue-300' : 'text-green-300'}`}>
                  <p className="text-xs text-white/40 mb-1">
                    {item.role === 'agent' ? 'Advisor' : 'You'}
                  </p>
                  <p className="text-sm text-white/80">{item.text}</p>
                </div>
              ))}
              {transcript.length === 0 && (
                <p className="text-white/40 text-sm">Conversation transcript will appear here...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#16162a] px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>
          
          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            disabled={!isConnected}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              !isVideoOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
          </button>
          
          {/* End Call */}
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
          
          {/* Speaker Toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            disabled={!isConnected}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
          </button>
          
          {/* Switch to Text Chat */}
          <button
            onClick={onSwitchToText}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            title="Switch to text chat"
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </button>
        </div>
        
        {/* Helper text */}
        <p className="text-center text-white/40 text-xs mt-3">
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
        
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};

export default VoiceChat;
