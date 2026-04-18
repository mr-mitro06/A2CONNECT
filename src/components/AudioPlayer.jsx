import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

export default function AudioPlayer({ src, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio(src);
    
    const setAudioData = () => setDuration(audioRef.current.duration);
    const setAudioTime = () => setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };

    audioRef.current.addEventListener('loadedmetadata', setAudioData);
    audioRef.current.addEventListener('timeupdate', setAudioTime);
    audioRef.current.addEventListener('ended', onEnd);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('loadedmetadata', setAudioData);
        audioRef.current.removeEventListener('timeupdate', setAudioTime);
        audioRef.current.removeEventListener('ended', onEnd);
      }
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      <button 
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 ${isMe ? 'bg-black text-white' : 'bg-white text-black'}`}
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>
      <div className="flex flex-col gap-1 w-32 sm:w-40">
        <div className={`h-1.5 w-full rounded-full overflow-hidden ${isMe ? 'bg-black/20' : 'bg-white/20'}`}>
           <div 
             className={`h-full rounded-full transition-all duration-75 ${isMe ? 'bg-black' : 'bg-white'}`} 
             style={{ width: `${progress}%` }}
           ></div>
        </div>
        <div className={`flex justify-between text-[10px] uppercase font-bold tracking-wider ${isMe ? 'text-black/50' : 'text-white/40'}`}>
          <span>Voice Message</span>
          <span>{audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}</span>
        </div>
      </div>
    </div>
  );
}
