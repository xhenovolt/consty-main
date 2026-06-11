'use client';

/**
 * CallUI — Google Meet-level audio/video call interface
 * WebRTC-based with screen sharing support
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  Monitor, MonitorOff, Maximize2, Minimize2, Clock,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';

export function CallUI({
  callType = 'audio', // 'audio' | 'video'
  conversationId,
  conversationName = 'Call',
  currentUserId,
  onEnd,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const toast = useToast();

  const [callState, setCallState] = useState('connecting'); // connecting, ringing, active, ended
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callId, setCallId] = useState(null);

  // Format duration
  const formatDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Initialize call
  useEffect(() => {
    let cancelled = false;

    async function initCall() {
      try {
        // Log call on backend
        const res = await api.post('/api/communication/calls', {
          conversation_id: conversationId,
          call_type: callType,
        }, { silent: true });

        if (res.ok && res.data?.id) {
          setCallId(res.data.id);
        }

        // Get user media
        const constraints = {
          audio: true,
          video: callType === 'video' ? { width: 1280, height: 720 } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (!cancelled) setCallState('active');
        toast.success(`${callType === 'video' ? 'Video' : 'Audio'} call started`);
      } catch (err) {
        if (!cancelled) {
          toast.error('Could not access camera/microphone');
          setCallState('ended');
          setTimeout(onEnd, 2000);
        }
      }
    }

    initCall();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [conversationId, callType, toast, onEnd]);

  // Duration timer
  useEffect(() => {
    if (callState !== 'active') return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      toast.info(isMuted ? 'Microphone on' : 'Microphone muted');
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
      toast.info(isVideoOff ? 'Camera on' : 'Camera off');
    }
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      toast.info('Screen sharing stopped');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);
      toast.success('Screen sharing started');

      // Listen for the user's manual stop
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        screenStreamRef.current = null;
      };
    } catch {
      toast.error('Could not share screen');
    }
  };

  // End call
  const endCall = async () => {
    setCallState('ended');

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());

    if (callId) {
      await api.patch(`/api/communication/calls/${callId}`, {
        status: 'ended',
        duration_seconds: duration,
      }, { silent: true });
    }

    toast.info('Call ended');
    setTimeout(onEnd, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 bg-gray-900 z-50 flex flex-col ${isFullscreen ? '' : ''}`}
    >
      {/* Video Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Remote video (or avatar) */}
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          {callState === 'active' && !isVideoOff ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <img
                  src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conversationName)}&size=128`}
                  alt=""
                  className="w-28 h-28 rounded-full"
                />
              </div>
              <h2 className="text-2xl font-bold text-white">{conversationName}</h2>
              <p className="text-white/60 mt-2 flex items-center justify-center gap-2">
                {callState === 'connecting' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                  </>
                )}
                {callState === 'active' && (
                  <>
                    <Clock className="w-4 h-4" /> {formatDuration(duration)}
                  </>
                )}
                {callState === 'ended' && 'Call ended'}
              </p>
            </div>
          )}
        </div>

        {/* Local video (PiP) */}
        {callType === 'video' && callState === 'active' && (
          <motion.div
            drag
            dragMomentum={false}
            className="absolute bottom-4 right-4 w-40 h-30 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-move"
          >
            {isVideoOff ? (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-white/40" />
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            )}
          </motion.div>
        )}

        {/* Screen share indicator */}
        {isScreenSharing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-500/20 backdrop-blur rounded-full flex items-center gap-2 text-emerald-400 text-sm">
            <Monitor className="w-4 h-4" /> Sharing your screen
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-gray-900/80 backdrop-blur border-t border-white/10 py-6">
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <CallControlButton
            onClick={toggleMute}
            active={isMuted}
            icon={isMuted ? MicOff : Mic}
            label={isMuted ? 'Unmute' : 'Mute'}
          />

          {/* Video toggle */}
          {callType === 'video' && (
            <CallControlButton
              onClick={toggleVideo}
              active={isVideoOff}
              icon={isVideoOff ? VideoOff : Video}
              label={isVideoOff ? 'Start video' : 'Stop video'}
            />
          )}

          {/* Screen share */}
          <CallControlButton
            onClick={toggleScreenShare}
            active={isScreenSharing}
            icon={isScreenSharing ? MonitorOff : Monitor}
            label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          />

          {/* End call */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition cursor-pointer active:scale-95"
            title="End call"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Fullscreen */}
          <CallControlButton
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
                setIsFullscreen(false);
              } else {
                document.documentElement.requestFullscreen();
                setIsFullscreen(true);
              }
            }}
            icon={isFullscreen ? Minimize2 : Maximize2}
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          />
        </div>

        {/* Duration */}
        {callState === 'active' && (
          <p className="text-center text-white/50 text-sm mt-3">
            {formatDuration(duration)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function CallControlButton({ onClick, active = false, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 ${
        active
          ? 'bg-white/20 text-white'
          : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export default CallUI;
