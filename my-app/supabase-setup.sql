-- Drop existing table and recreate from scratch
DROP TABLE IF EXISTS timers CASCADE;

-- Create timers table for persistent storage
CREATE TABLE timers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  time_remaining INTEGER NOT NULL,
  total_time INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('stopped', 'running', 'paused')),
  display_order INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_timers_updated_at ON timers(updated_at);

-- Enable Row Level Security
ALTER TABLE timers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is a public app)
-- You can make this more restrictive based on your needs
CREATE POLICY "Allow all operations on timers" ON timers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_timers_updated_at
    BEFORE UPDATE ON timers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
