"use client";

import { useState, useEffect } from "react";

type TimerState = "stopped" | "running" | "paused";

interface Timer {
  id: string;
  name: string;
  timeRemaining: number;
  totalTime: number;
  state: TimerState;
}

const COLORS = [
  "from-blue-600 to-blue-800",
  "from-blue-700 to-purple-700",
  "from-purple-600 to-purple-800",
  "from-indigo-600 to-blue-700",
];

export default function ProjectionPage() {
  const [timers, setTimers] = useState<Timer[]>([]);

  // Load timers from localStorage and listen for updates
  useEffect(() => {
    const loadTimers = () => {
      const stored = localStorage.getItem("timers");
      if (stored) {
        try {
          setTimers(JSON.parse(stored));
        } catch (e) {
          console.error("Error parsing timers:", e);
        }
      }
    };

    // Initial load
    loadTimers();

    // Listen for storage changes
    const handleStorageChange = () => {
      loadTimers();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("timers-updated", loadTimers);

    // Poll for updates (fallback)
    const interval = setInterval(loadTimers, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("timers-updated", loadTimers);
      clearInterval(interval);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = (timer: Timer): number => {
    if (timer.totalTime === 0) return 0;
    return (timer.timeRemaining / timer.totalTime) * 100;
  };

  const getTimerColor = (index: number): string => {
    return COLORS[index % COLORS.length];
  };

  if (timers.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏱️</div>
          <p className="text-xl text-zinc-400">Aguardando cronómetros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full">
        {/* Timers Display - Full Screen Optimized */}
        <div
          className={`grid gap-8 ${
            timers.length === 1
              ? "grid-cols-1 max-w-5xl mx-auto"
              : "grid-cols-1 md:grid-cols-2 max-w-screen-2xl mx-auto"
          }`}
        >
          {timers.map((timer, index) => (
            <div
              key={timer.id}
              className={`relative flex flex-col items-center justify-center p-8 md:p-12 rounded-3xl transition-all duration-500 border-4 ${
                timer.state === "running"
                  ? `bg-gradient-to-br ${getTimerColor(index)} shadow-2xl shadow-blue-500/50 border-white/30`
                  : "bg-gradient-to-br from-zinc-900 to-black shadow-2xl border-zinc-700/30"
              }`}
            >
              {/* Timer Name */}
              <h2 className="text-4xl md:text-5xl font-bold text-center mb-8">{timer.name}</h2>

              {/* Timer Display - Much Larger */}
              <div
                className={`text-[10rem] md:text-[12rem] leading-none font-mono font-black mb-8 tracking-wider drop-shadow-2xl ${
                  timer.timeRemaining < 0
                    ? "text-red-500 animate-pulse drop-shadow-[0_0_40px_rgba(239,68,68,1)]"
                    : timer.timeRemaining <= 30 && timer.timeRemaining > 0
                    ? "text-red-400 animate-pulse drop-shadow-[0_0_30px_rgba(248,113,113,0.8)]"
                    : timer.timeRemaining === 0
                    ? "text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,1)]"
                    : "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                }`}
              >
                {formatTime(timer.timeRemaining)}
              </div>

              {/* Progress Bar - Larger */}
              <div className="w-full h-8 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    getProgressPercentage(timer) > 50
                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                      : getProgressPercentage(timer) > 25
                      ? "bg-gradient-to-r from-purple-500 to-purple-600"
                      : getProgressPercentage(timer) > 10
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${getProgressPercentage(timer)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
