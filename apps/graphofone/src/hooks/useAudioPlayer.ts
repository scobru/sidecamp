import { useState, useRef } from 'react';

export function useAudioPlayer() {
  const [currentPlayback, setCurrentPlayback] = useState<{ name: string, path: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTrack = (name: string, path: string) => {
    setCurrentPlayback({ name, path });
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = `media://${encodeURIComponent(path)}`;
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (vol: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = vol;
    setVolume(vol);
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentPlayback(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return {
    currentPlayback,
    isPlaying,
    currentTime,
    duration,
    volume,
    audioRef,
    playTrack,
    togglePlay,
    handleSeek,
    handleVolumeChange,
    stopPlayback,
    formatTime,
    setCurrentTime,
    setDuration
  };
}
