"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase, TIMER_CHANNEL, Timer, TimerState, TimerPayload, saveTimersToDatabase, loadTimersFromDatabase, testDatabaseConnection } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

const DEFAULT_TIME = 5 * 60;

const generateId = () => Math.random().toString(36).substring(2, 9);

const COLORS = [
  "from-blue-600 to-blue-800",
  "from-blue-700 to-purple-700",
  "from-purple-600 to-purple-800",
  "from-indigo-600 to-blue-700",
];

export default function ControlPage() {
  // Initialize with default timers
  const [timers, setTimers] = useState<Timer[]>([
    {
      id: generateId(),
      name: "Orador 1",
      timeRemaining: DEFAULT_TIME,
      totalTime: DEFAULT_TIME,
      state: "stopped",
    },
    {
      id: generateId(),
      name: "Orador 2",
      timeRemaining: DEFAULT_TIME,
      totalTime: DEFAULT_TIME,
      state: "stopped",
    },
  ]);

  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isInitializedRef = useRef(false);
  const lastBroadcastTime = useRef(0);
  const lastReceivedBroadcast = useRef(0);
  const isCountingRef = useRef(false);

  // Broadcast timers to all connected clients via Supabase Realtime and save to database
  const broadcastTimers = useCallback((newTimers: Timer[], saveToDb: boolean = true) => {
    // Save to database in background (non-blocking) only when explicitly requested
    if (saveToDb) {
      saveTimersToDatabase(newTimers).catch(err => 
        console.error('Failed to save to database:', err)
      );
    }
    
    // Always broadcast to real-time channel (fast)
    if (channelRef.current) {
      const payload: TimerPayload = {
        timers: newTimers,
        lastUpdate: Date.now(),
      };
      channelRef.current.send({
        type: "broadcast",
        event: "timer-update",
        payload,
      });
    }
    
    // Also save to localStorage as fallback
    localStorage.setItem("timers", JSON.stringify(newTimers));
    window.dispatchEvent(new Event("timers-updated"));
  }, []);

  // Load timers from database on mount
  useEffect(() => {
    const loadInitialData = async () => {
      // Test database connection first
      await testDatabaseConnection();
      
      console.log('🔄 Loading timers from database...');
      const dbTimers = await loadTimersFromDatabase();
      console.log('📊 Database returned:', dbTimers.length, 'timers');
      
      // Only override default timers if database has data
      if (dbTimers.length > 0) {
        console.log('✅ Using database timers');
        setTimers(dbTimers);
      } else {
        console.log('⚠️ No timers in database, saving defaults');
        // Save current default timers to database
        setTimers(prev => {
          saveTimersToDatabase(prev);
          return prev;
        });
      }
    };
    loadInitialData();
  }, []);

  // Setup Supabase Realtime channel for broadcasts and database changes
  useEffect(() => {
    const channel = supabase.channel(TIMER_CHANNEL, {
      config: {
        broadcast: { self: true },
      },
    });

    // Listen for broadcast updates
    channel
      .on("broadcast", { event: "timer-update" }, ({ payload }) => {
        if (payload && payload.timers && payload.lastUpdate) {
          // Only apply if this is from another device (different timestamp)
          const timeDiff = Math.abs(payload.lastUpdate - lastBroadcastTime.current);
          if (timeDiff > 50) { // More than 50ms difference = from another device
            // Track when we receive broadcasts from OTHER devices
            lastReceivedBroadcast.current = Date.now();
            setTimers(payload.timers);
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          // Don't broadcast on initial connection - just listen
          // Database load will handle the initial state
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Timer logic - countdown running timers
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      const now = Date.now();
      
      // If we received a broadcast in the last 2 seconds, another device is running the countdown
      // Don't run our own countdown to avoid conflicts
      const timeSinceLastBroadcast = now - lastReceivedBroadcast.current;
      if (timeSinceLastBroadcast < 2000 && lastReceivedBroadcast.current > 0) {
        return; // Another device is handling the countdown
      }
      
      setTimers((prev) => {
        const hasRunning = prev.some((t) => t.state === "running");
        if (!hasRunning) {
          isCountingRef.current = false;
          return prev;
        }

        isCountingRef.current = true;
        const updated = prev.map((timer) => {
          if (timer.state === "running") {
            return { ...timer, timeRemaining: timer.timeRemaining - 1 };
          }
          return timer;
        });

        tickCount++;
        // Update the last broadcast time before broadcasting
        lastBroadcastTime.current = now;
        // Only save to database every 5 seconds to reduce lag
        // Broadcast every second for smooth updates
        const saveToDb = tickCount % 5 === 0;
        broadcastTimers(updated, saveToDb);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty deps - broadcastTimers is stable

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
    return (timer.timeRemaining / timer.totalTime) * 100;
  };

  const getProgressColor = (timer: Timer): string => {
    const percentage = getProgressPercentage(timer);
    if (percentage > 50) return "bg-gradient-to-r from-blue-500 to-blue-600";
    if (percentage > 25) return "bg-gradient-to-r from-purple-500 to-purple-600";
    if (percentage > 10) return "bg-gradient-to-r from-indigo-500 to-purple-600";
    return "bg-red-500";
  };

  const getTimerColor = (index: number): string => {
    return COLORS[index % COLORS.length];
  };

  const startTimer = useCallback((timerId: string) => {
    // When starting, this device becomes the leader immediately
    lastReceivedBroadcast.current = 0;
    lastBroadcastTime.current = Date.now();
    
    setTimers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === timerId && t.timeRemaining > 0) {
          return { ...t, state: "running" as TimerState };
        }
        return t;
      });
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const pauseTimer = useCallback((timerId: string) => {
    setTimers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === timerId) {
          return { ...t, state: "paused" as TimerState };
        }
        return t;
      });
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const resetTimer = useCallback((timerId: string) => {
    setTimers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === timerId) {
          return { ...t, timeRemaining: t.totalTime, state: "stopped" as TimerState };
        }
        return t;
      });
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const resetAll = useCallback(() => {
    setTimers((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        timeRemaining: t.totalTime,
        state: "stopped" as TimerState,
      }));
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const pauseAll = useCallback(() => {
    setTimers((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        state: t.state === "running" ? ("paused" as TimerState) : t.state,
      }));
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const updateTimerName = useCallback((timerId: string, name: string) => {
    setTimers((prev) => {
      const updated = prev.map((t) => {
        if (t.id === timerId) {
          return { ...t, name };
        }
        return t;
      });
      broadcastTimers(updated);
      return updated;
    });
  }, [broadcastTimers]);

  const updateTimerTime = useCallback(
    (timerId: string, minutes: number, seconds: number) => {
      const totalSeconds = minutes * 60 + seconds;
      setTimers((prev) => {
        const updated = prev.map((t) => {
          if (t.id === timerId) {
            return {
              ...t,
              timeRemaining: totalSeconds,
              totalTime: totalSeconds,
              state: "stopped" as TimerState,
            };
          }
          return t;
        });
        broadcastTimers(updated);
        return updated;
      });
    },
    [broadcastTimers]
  );

  const addTimer = useCallback(() => {
    const totalSeconds = customMinutes * 60 + customSeconds;
    const newTimer: Timer = {
      id: generateId(),
      name: `Orador ${timers.length + 1}`,
      timeRemaining: totalSeconds,
      totalTime: totalSeconds,
      state: "stopped",
    };
    setTimers((prev) => {
      const updated = [...prev, newTimer];
      broadcastTimers(updated);
      return updated;
    });
  }, [customMinutes, customSeconds, timers.length, broadcastTimers]);

  const removeTimer = useCallback((timerId: string) => {
    if (timers.length <= 1) return;
    setTimers((prev) => {
      const updated = prev.filter((t) => t.id !== timerId);
      broadcastTimers(updated);
      return updated;
    });
  }, [timers.length, broadcastTimers]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Top Navigation */}
      <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Cronómetros</h1>
                <p className="text-xs text-gray-400">{timers.length} ativo{timers.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/projecao"
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Projeção</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Control Panel */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Time Config */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 font-medium">Tempo Padrão:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 h-12 bg-gray-900 border border-gray-700 rounded-lg text-center text-lg font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                />
                <span className="text-gray-500 font-bold">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-14 h-12 bg-gray-900 border border-gray-700 rounded-lg text-center text-lg font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={addTimer}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Adicionar</span>
              </button>
              <button
                onClick={pauseAll}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-all"
              >
                Pausar Todos
              </button>
              <button
                onClick={resetAll}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-all"
              >
                Reset Geral
              </button>
            </div>
          </div>
        </div>

        {/* Timers Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {timers.map((timer, index) => (
            <div
              key={timer.id}
              className={`bg-gray-800/50 backdrop-blur-sm rounded-xl border transition-all duration-300 ${
                timer.state === "running"
                  ? "border-blue-500/60 shadow-lg shadow-blue-500/20"
                  : "border-gray-700/50 hover:border-gray-600/50"
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-700/50">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={timer.name}
                    onChange={(e) => updateTimerName(timer.id, e.target.value)}
                    className="text-base font-semibold bg-transparent border-none focus:outline-none text-white flex-1"
                  />
                  <div className="flex items-center gap-2">
                    {timer.state === "running" && (
                      <span className="flex items-center gap-1.5 text-xs text-blue-400">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                        Live
                      </span>
                    )}
                    {timers.length > 1 && (
                      <button
                        onClick={() => removeTimer(timer.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-700/50 hover:bg-red-600 text-gray-400 hover:text-white transition-all"
                        title="Remover"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                {/* Timer Display */}
                <div className="mb-5">
                  <div
                    className={`text-5xl font-mono font-bold text-center mb-3 ${
                      timer.timeRemaining < 0
                        ? "text-red-400 animate-pulse"
                        : timer.timeRemaining <= 30 && timer.timeRemaining > 0
                        ? "text-red-400 animate-pulse"
                        : "text-white"
                    }`}
                  >
                    {formatTime(timer.timeRemaining)}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        timer.timeRemaining < 0 || (timer.timeRemaining <= 30 && timer.timeRemaining > 0)
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : "bg-gradient-to-r from-blue-500 to-purple-600"
                      }`}
                      style={{ width: `${getProgressPercentage(timer)}%` }}
                    />
                  </div>
                </div>

                {/* Time Config */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={Math.floor(timer.totalTime / 60)}
                    onChange={(e) => {
                      const mins = Math.max(0, parseInt(e.target.value) || 0);
                      const secs = timer.totalTime % 60;
                      updateTimerTime(timer.id, mins, secs);
                    }}
                    disabled={timer.state === "running"}
                    className="w-12 h-10 bg-gray-900 border border-gray-700 rounded-lg text-center text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <span className="text-gray-500 font-bold">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timer.totalTime % 60}
                    onChange={(e) => {
                      const mins = Math.floor(timer.totalTime / 60);
                      const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      updateTimerTime(timer.id, mins, secs);
                    }}
                    disabled={timer.state === "running"}
                    className="w-12 h-10 bg-gray-900 border border-gray-700 rounded-lg text-center text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex gap-2">
                  {timer.state !== "running" ? (
                    <button
                      onClick={() => startTimer(timer.id)}
                      disabled={timer.timeRemaining === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-95 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all touch-manipulation"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseTimer(timer.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white text-sm font-medium rounded-lg transition-all touch-manipulation"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                      </svg>
                      Pause
                    </button>
                  )}
                  <button
                    onClick={() => resetTimer(timer.id)}
                    className="px-3 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-sm font-medium rounded-lg transition-all touch-manipulation"
                    title="Reset"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
