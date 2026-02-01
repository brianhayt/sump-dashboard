import { createClient } from '@supabase/supabase-js'
import DashboardClient from './DashboardClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0;

async function getData() {
  const { data: latest, error: latestError } = await supabase
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestError) {
    console.error('Error fetching latest reading:', latestError);
  }

  const { data: daily, error: dailyError } = await supabase
    .from('daily_summaries')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (dailyError) {
    console.error('Error fetching daily summary:', dailyError);
  }

  // Fetch 24h of history for time range filtering on client
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: history, error: historyError } = await supabase
    .from('readings')
    .select('created_at, water_level_inches')
    .gt('created_at', yesterday)
    .order('created_at', { ascending: true });

  if (historyError) {
    console.error('Error fetching history:', historyError);
  }

  // Fetch recent events for the event history panel
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
  }

  return { latest, daily, history, events };
}

export default async function Page() {
  const data = await getData();
  
  if (!data.latest) {
    return <div className="bg-slate-950 min-h-screen p-10 text-white">No sensor data found in Supabase. Check your ESP32 connection.</div>;
  }

  return <DashboardClient latest={data.latest} daily={data.daily} history={data.history || []} events={data.events || []} />;
}