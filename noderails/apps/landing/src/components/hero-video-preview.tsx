'use client';

import { useEffect, useRef, useState } from 'react';

const HERO_VIDEO_URL = 'https://pub-5de3d40148a9489b9951aac59a6be2dc.r2.dev/5VDHW4mI9WXOiy4n_9.mp4';

export function HeroVideoPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    const player = videoRef.current;
    if (!player) return;

    let cancelled = false;

    const playVideo = async () => {
      try {
        // Try to play with sound
        player.muted = false;
        player.volume = 1;
        await player.play();
        if (!cancelled) setIsMuted(false);
      } catch {
        // Browser policy blocked unmuted autoplay; fallback to muted
        player.muted = true;
        if (!cancelled) setIsMuted(true);
        try {
          await player.play();
        } catch {
          console.log('Autoplay failed even with muted, user interaction may be required');
          // If still blocked, user can interact via mute button
        }
      }
    };

    void playVideo();

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  return (
    <div>
      <div className="flex items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="ml-3 flex-1 bg-white rounded px-3 py-1 text-[10px] text-slate-400 font-mono border border-slate-100">
          merchant.noderails.com
        </div>
      </div>

      <div className="relative bg-slate-950 w-full">
        <video
          ref={videoRef}
          className={`w-full h-auto object-contain transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setIsReady(true)}
        >
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>

        {!isReady ? <div className="absolute inset-0 animate-pulse bg-slate-900/60" /> : null}

        {isReady ? (
          <button
            type="button"
            className="absolute bottom-3 right-3 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-slate-900 transition-colors"
            onClick={() => {
              const player = videoRef.current;
              if (!player) return;

              const nextMuted = !isMuted;
              player.muted = nextMuted;
              if (!nextMuted) player.volume = 1;
              setIsMuted(nextMuted);
              void player.play().catch(() => {});
            }}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
