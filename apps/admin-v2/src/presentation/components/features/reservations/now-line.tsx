'use client';

import { useState, useEffect } from 'react';

interface NowLineProps {
  startHour: number;
  endHour: number;
  hourHeight: number;
}

export function NowLine({ startHour, endHour, hourHeight }: NowLineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours() + now.getMinutes() / 60;

  if (hours < startHour || hours > endHour) return null;

  const top = (hours - startHour) * hourHeight;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: `${top}px` }}
    >
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
      <div className="h-px flex-1 bg-rose-500" />
    </div>
  );
}
