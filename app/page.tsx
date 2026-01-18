import { createClient } from '@supabase/supabase-js'
import DashboardClient from './DashboardClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0;

async function getData() {
  const { data: latest } = await supabase
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: daily } = await supabase
    .from('daily_summaries')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from('readings')
    .select('created_at, water_level_inches')
    .gt('created_at', yesterday)
    .order('created_at', { ascending: true });

  return { latest, daily, history };
}

export default async function Page() {
  const data = await getData();
  
  if (!data.latest) {
    return <div className="bg-slate-950 min-h-screen p-10 text-white">No sensor data found in Supabase. Check your ESP32 connection.</div>;
  }

  return <DashboardClient latest={data.latest} daily={data.daily} history={data.history || []} />;
}