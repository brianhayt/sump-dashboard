import { createClient } from '@supabase/supabase-js'
import StatsClient from './StatsClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0;

async function getStatsData() {
  // Get date strings for queries
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Last 7 days for weekly view
  const { data: weeklyData, error: weeklyError } = await supabase
    .from('daily_summaries')
    .select('date, total_cycles, total_gallons')
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: true });

  if (weeklyError) {
    console.error('Error fetching weekly data:', weeklyError);
  }

  // Last 30 days for monthly heatmap
  const { data: monthlyData, error: monthlyError } = await supabase
    .from('daily_summaries')
    .select('date, total_cycles, total_gallons')
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true });

  if (monthlyError) {
    console.error('Error fetching monthly data:', monthlyError);
  }

  // All-time record (busiest day by gallons)
  const { data: busiestDay, error: busiestError } = await supabase
    .from('daily_summaries')
    .select('date, total_cycles, total_gallons')
    .order('total_gallons', { ascending: false })
    .limit(1)
    .single();

  if (busiestError && busiestError.code !== 'PGRST116') {
    console.error('Error fetching busiest day:', busiestError);
  }

  // Day with most cycles
  const { data: mostCyclesDay, error: cyclesError } = await supabase
    .from('daily_summaries')
    .select('date, total_cycles, total_gallons')
    .order('total_cycles', { ascending: false })
    .limit(1)
    .single();

  if (cyclesError && cyclesError.code !== 'PGRST116') {
    console.error('Error fetching most cycles day:', cyclesError);
  }

  // All-time totals - fetch all records and sum client-side
  // (Supabase JS doesn't support aggregate functions directly)
  const { data: allData, error: allError } = await supabase
    .from('daily_summaries')
    .select('total_cycles, total_gallons');

  if (allError) {
    console.error('Error fetching all-time data:', allError);
  }

  const allTimeTotals = allData?.reduce(
    (acc, row) => ({
      totalCycles: acc.totalCycles + (row.total_cycles || 0),
      totalGallons: acc.totalGallons + (row.total_gallons || 0),
    }),
    { totalCycles: 0, totalGallons: 0 }
  ) || { totalCycles: 0, totalGallons: 0 };

  // Recent events (power outages, backup activations, sensor errors)
  const { data: recentEvents, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .in('event_type', ['power_outage', 'power_restored', 'backup_alarm_on', 'backup_alarm_off', 'sensor_error', 'sensor_restored', 'high_water', 'low_battery'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
  }

  return {
    weeklyData: weeklyData || [],
    monthlyData: monthlyData || [],
    busiestDay,
    mostCyclesDay,
    allTimeTotals,
    recentEvents: recentEvents || [],
  };
}

export default async function StatsPage() {
  const data = await getStatsData();

  return <StatsClient {...data} />;
}
