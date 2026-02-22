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
      .select('date, total_cycles, total_gallons, avg_temperature_f, avg_humidity_pct')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true }),

    // Monthly data (last 30 days)
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons, avg_temperature_f, avg_humidity_pct')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true }),

    // Busiest day (most gallons)
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons, avg_temperature_f, avg_humidity_pct')
      .order('total_gallons', { ascending: false })
      .limit(1),

    // Day with most cycles
    supabase
      .from('daily_summaries')
      .select('date, total_cycles, total_gallons, avg_temperature_f, avg_humidity_pct')
      .order('total_cycles', { ascending: false })
      .limit(1),

    // Recent events
    supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  // Fetch all-time totals and pump cycle events in parallel
  const [allTimeResult, pumpEventsResult] = await Promise.all([
    supabase
      .from('daily_summaries')
      .select('total_cycles, total_gallons'),

    // Pump cycle events for last 7 days (for avg time between cycles)
    supabase
      .from('events')
      .select('created_at')
      .eq('event_type', 'pump_cycle_end')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000)
  ]);

  const allTimeTotals = (allTimeResult.data || []).reduce(
    (acc, day) => ({
      totalCycles: acc.totalCycles + (day.total_cycles || 0),
      totalGallons: acc.totalGallons + (day.total_gallons || 0)
    }),
    { totalCycles: 0, totalGallons: 0 }
  );

  // Compute average minutes between pump cycles per day
  const pumpEvents = pumpEventsResult.data || [];
  const eventsByDay = new Map<string, Date[]>();
  for (const event of pumpEvents) {
    const date = new Date(event.created_at);
    // Group by date in local Eastern time (matches dashboard convention)
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (!eventsByDay.has(dateStr)) eventsByDay.set(dateStr, []);
    eventsByDay.get(dateStr)!.push(date);
  }

  const pumpIntervals: { date: string; avgMinutesBetweenCycles: number | null }[] = [];
  for (const [dateStr, times] of eventsByDay) {
    if (times.length < 2) {
      pumpIntervals.push({ date: dateStr, avgMinutesBetweenCycles: null });
      continue;
    }
    let totalMinutes = 0;
    for (let i = 1; i < times.length; i++) {
      totalMinutes += (times[i].getTime() - times[i - 1].getTime()) / 60000;
    }
    pumpIntervals.push({
      date: dateStr,
      avgMinutesBetweenCycles: Math.round(totalMinutes / (times.length - 1))
    });
  }

  return {
    weeklyData: weekly.data || [],
    monthlyData: monthly.data || [],
    busiestDay: busiestDay.data?.[0] || null,
    mostCyclesDay: mostCyclesDay.data?.[0] || null,
    allTimeTotals,
    recentEvents: events.data || [],
    pumpIntervals
  };
}

export default async function StatsPage() {
  const data = await getStatsData();
  return <StatsClient {...data} />;
}
