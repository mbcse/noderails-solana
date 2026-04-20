'use client';

import { useEffect, useState } from 'react';
import { HeroDashboardFloatingCards, HeroDashboardPreview } from '@/components/hero-dashboard-preview';
import { HeroVideoPreview } from '@/components/hero-video-preview';

const VIDEO_SWITCH_DELAY_MS = 5000;

export function HeroPreviewSwitcher() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowVideo(true);
    }, VIDEO_SWITCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="relative">
      <div className="glass-card rounded-2xl overflow-hidden relative shadow-2xl border border-slate-200/60">
        {showVideo ? <HeroVideoPreview /> : <HeroDashboardPreview />}
      </div>

      {!showVideo ? <HeroDashboardFloatingCards /> : null}
    </div>
  );
}
