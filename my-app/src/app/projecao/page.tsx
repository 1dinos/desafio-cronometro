"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, TIMER_CHANNEL, Timer, TimerPayload, loadTimersFromDatabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

const COLORS = [
  "from-blue-600 to-blue-800",
  "from-blue-700 to-purple-700",
  "from-purple-600 to-purple-800",
  "from-indigo-600 to-blue-700",
];

export default function ProjectionPage() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Setup Supabase Realtime channel and load from database
  useEffect(() => {
    // Load initial state from database
    const loadFromDatabase = async () => {
      const dbTimers = await loadTimersFromDatabase();
      if (dbTimers.length > 0) {
        setTimers(dbTimers);
      } else {
        // Fallback to localStorage if database is empty
        const stored = localStorage.getItem("timers");
        if (stored) {
          try {
            setTimers(JSON.parse(stored));
          } catch (e) {
            console.error("Error parsing timers:", e);
          }
        }
      }
    };
    loadFromDatabase();

    // Subscribe to broadcast updates (fast, real-time)
    const channel = supabase.channel(TIMER_CHANNEL, {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on("broadcast", { event: "timer-update" }, ({ payload }) => {
        if (payload && payload.timers) {
          setTimers(payload.timers);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const timeString = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return isNegative ? `-${timeString}` : timeString;
  };

  const getProgressPercentage = (timer: Timer): number => {
    if (timer.totalTime === 0) return 0;
    const percentage = (timer.timeRemaining / timer.totalTime) * 100;
    return Math.max(0, Math.min(100, percentage));
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
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
            isConnected 
              ? "bg-green-500/20 text-green-400" 
              : "bg-yellow-500/20 text-yellow-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}></span>
            {isConnected ? "Conectado" : "A conectar..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      {/* Connection indicator */}
      <div className={`fixed top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        isConnected 
          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
          : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
      }`}>
        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}></span>
        {isConnected ? "Sincronizado" : "A conectar..."}
      </div>
      
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
              className={`relative flex flex-col items-center justify-center p-8 md:p-12 rounded-3xl border-4 ${
                timer.state === "running"
                  ? `bg-gradient-to-br ${getTimerColor(index)} shadow-2xl shadow-blue-500/50 border-white/30`
                  : "bg-gradient-to-br from-zinc-900 to-black shadow-2xl border-zinc-700/30"
              }`}
            >
              {/* Timer Name */}
              <h2 className="text-4xl md:text-5xl font-bold text-center mb-8">{timer.name}</h2>

              {/* Timer Display - Much Larger */}
              <div
                className={`text-[10rem] md:text-[12rem] leading-none font-black mb-8 tracking-tight drop-shadow-2xl font-[var(--font-orbitron)] ${
                  timer.timeRemaining <= 0
                    ? "text-red-500 animate-pulse drop-shadow-[0_0_40px_rgba(239,68,68,1)]"
                    : timer.timeRemaining <= 30 && timer.timeRemaining > 0
                    ? "text-red-400 animate-pulse drop-shadow-[0_0_30px_rgba(248,113,113,0.8)]"
                    : "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                }`}
              >
                {formatTime(timer.timeRemaining)}
              </div>

              {/* Progress Bar - Larger */}
              <div className="w-full h-8 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
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
