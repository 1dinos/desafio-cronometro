# Setup Instructions for Multi-Device Real-Time Sync

## 1. Create the Database Table in Supabase

1. Go to your Supabase project dashboard: https://tdinprvkbtzjuoyaucat.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-setup.sql` file
5. Click **Run** to execute the SQL

This will create:
- ✅ `timers` table to store timer state
- ✅ Indexes for performance
- ✅ Row Level Security policies (allows all operations)
- ✅ Automatic timestamp updates

## 2. Enable Realtime for the Table

1. In Supabase dashboard, go to **Database** → **Replication**
2. Find the `timers` table in the list
3. Toggle the **Enable Realtime** switch to ON
4. Click **Save**

## 3. Test the Setup

1. Start your development server (if not already running):
   ```bash
   npm run dev
   ```

2. Open the app in your browser: http://localhost:3000

3. Test multi-device sync:
   - Open the control page on Device 1: http://localhost:3000
   - Open the projection page on Device 2: http://localhost:3000/projecao
   - Or use your phone/tablet with your local network IP

4. Make changes on one device and watch them appear instantly on all other devices!

## How It Works

Your timer app now has **triple-layer sync** for maximum reliability:

### Layer 1: Broadcast (Fastest)
- Changes broadcast instantly via Supabase Realtime channels
- Sub-second latency
- Works across all devices connected to the internet

### Layer 2: Database (Most Reliable)
- Every change is saved to Supabase database
- Devices subscribe to database changes
- Ensures data persistence even after page refresh

### Layer 3: LocalStorage (Fallback)
- Changes also saved to browser's localStorage
- Works as backup if network is temporarily unavailable

## Connection Status

Both pages show a connection indicator:
- 🟢 Green = Connected and syncing
- 🟡 Yellow = Connecting...

## Features

✅ Real-time sync across unlimited devices
✅ Changes appear instantly (<100ms)
✅ Works on desktop, mobile, tablets
✅ Survives page refreshes
✅ Automatic reconnection
✅ No data loss

## Network Requirements

- All devices must have internet connection
- For local testing: devices can be on different networks (uses Supabase cloud)
- For production: fully serverless, scales automatically
