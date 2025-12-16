import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Channel name for real-time sync
export const TIMER_CHANNEL = 'timer-sync';

export type TimerState = "stopped" | "running" | "paused";

export interface Timer {
  id: string;
  name: string;
  timeRemaining: number;
  totalTime: number;
  state: TimerState;
}

export interface TimerPayload {
  timers: Timer[];
  lastUpdate: number;
}

// Database types for Supabase
export interface TimerRow {
  id: string;
  name: string;
  time_remaining: number;
  total_time: number;
  state: TimerState;
  display_order: number;
  updated_at?: string;
}

// Save all timers to database
export async function saveTimersToDatabase(timers: Timer[]): Promise<void> {
  try {
    // Delete all existing timers
    await supabase.from('timers').delete().neq('id', '');
    
    // Insert all timers with their display order
    const rows: TimerRow[] = timers.map((timer, index) => ({
      id: timer.id,
      name: timer.name,
      time_remaining: timer.timeRemaining,
      total_time: timer.totalTime,
      state: timer.state,
      display_order: index,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from('timers').insert(rows);
      if (error) {
        console.error('Error saving timers to database:', error);
      }
    }
  } catch (error) {
    console.error('Error in saveTimersToDatabase:', error);
  }
}

// Load all timers from database
export async function loadTimersFromDatabase(): Promise<Timer[]> {
  try {
    const { data, error } = await supabase
      .from('timers')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading timers from database:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: TimerRow) => ({
      id: row.id,
      name: row.name,
      timeRemaining: row.time_remaining,
      totalTime: row.total_time,
      state: row.state,
    }));
  } catch (error) {
    console.error('Error in loadTimersFromDatabase:', error);
    return [];
  }
}
