import { createClient } from '@supabase/supabase-js'
import StatsClient from './StatsClient'

export const revalidate = 60; // Revalidate every 60 seconds

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getStatsData() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // Fetch all data in parallel
  const [weekly, monthly, busiestDay, mostCyclesDay, events] = await Promise.all([
    // Weekly data (last 7 days)
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true }),

    // Monthly data (last 30 days)
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true }),

    // Busiest day (most gallons)
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons')
      .order('total_gallons', { ascending: false })
      .limit(1),

    // Day with most cycles
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons')
      .order('total_cycles', { ascending: false })
      .limit(1),

    // Recent events
    supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  // Fetch all-time totals separately
  const { data: allData } = await supabase
    .from('daily_summaries')
    .select('total_cycles, total_gallons');

  const allTimeTotals = (allData || []).reduce(
    (acc, day) => ({
      totalCycles: acc.totalCycles + (day.total_cycles || 0),
      totalGallons: acc.totalGallons + (day.total_gallons || 0)
    }),
    { totalCycles: 0, totalGallons: 0 }
  );

  return {
    weeklyData: weekly.data || [],
    monthlyData: monthly.data || [],
    busiestDay: busiestDay.data?.[0] || null,
    mostCyclesDay: mostCyclesDay.data?.[0] || null,
    allTimeTotals,
    recentEvents: events.data || []
  };
}

export default async function StatsPage() {
  const data = await getStatsData();
  return <StatsClient {...data} />;
}
