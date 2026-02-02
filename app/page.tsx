import { createClient } from '@supabase/supabase-js'
import DashboardClient from './DashboardClient'

// Force dynamic rendering so data is always fresh on reload
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getData() {
  // 1. Get latest single reading for the "Live Cards"
  const { data: latest } = await supabase
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Get today's stats (from daily_summaries if available, else 0)
  const { data: daily } = await supabase
    .from('daily_summaries')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // 3. Get History for Graph (Fixing the "3AM Cutoff")
  // We fetch the NEWEST 2000 records first, then reverse them.
  // This guarantees we see "Now" even if there are 5000 rows in the DB.
  const { data: historyRaw } = await supabase
    .from('readings')
    .select('created_at, water_level_inches, pump_running')
    .order('created_at', { ascending: false }) // Newest first
    .limit(2000); // 2000 minutes = ~33 hours history

  // Reverse so the chart draws Left (Old) -> Right (New)
  const history = historyRaw ? historyRaw.reverse() : [];

  // 4. Get recent events for the event log
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return { latest, daily, history, events };
}

export default async function Page() {
  const data = await getData();
  
  if (!data.latest) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        No sensor data found. Check ESP32 connection.
      </div>
    );
  }

  return <DashboardClient latest={data.latest} daily={data.daily} history={data.history} events={data.events || []} />;
}
