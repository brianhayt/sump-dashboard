import { createClient } from '@supabase/supabase-js'
import StatsClient from './StatsClient'

export const revalidate = 60;

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

  const [weekly, monthly, busiestDay, mostCyclesDay, events] = await Promise.all([
    supabase.from('daily_summaries').select('*').gte('date', sevenDaysAgo.toISOString().split('T')[0]).order('date', { ascending: true }),
    supabase.from('daily_summaries').select('*').gte('date', thirtyDaysAgo.toISOString().split('T')[0]).order('date', { ascending: true }),
    supabase.from('daily_summaries').select('*').order('total_gallons', { ascending: false }).limit(1),
    supabase.from('daily_summaries').select('*').order('total_cycles', { ascending: false }).limit(1),
    supabase.from('events').select('*').order('created_at', { ascending: false }).limit(20)
  ]);

  // FIX: Get the MOST RECENT events first and increase limit to handle 800+ cycles/day
  const [allTimeResult, pumpEventsResult] = await Promise.all([
    supabase.from('daily_summaries').select('total_cycles, total_gallons'),
    supabase.from('events')
      .select('created_at')
      .eq('event_type', 'pump_cycle_end')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false }) // Get newest first
      .limit(10000) // Increased limit for high-frequency pumps
  ]);

  const allTimeTotals = (allTimeResult.data || []).reduce(
    (acc, day) => ({
      totalCycles: acc.totalCycles + (day.total_cycles || 0),
      totalGallons: acc.totalGallons + (day.total_gallons || 0)
    }),
    { totalCycles: 0, totalGallons: 0 }
  );

  // Reverse the array so the math [i] - [i-1] works chronologically
  const pumpEvents = (pumpEventsResult.data || []).reverse();
  const eventsByDay = new Map<string, Date[]>();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    eventsByDay.set(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }), []);
  }

  for (const event of pumpEvents) {
    const dateStr = new Date(event.created_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (eventsByDay.has(dateStr)) eventsByDay.get(dateStr)!.push(new Date(event.created_at));
  }

  const pumpIntervals = Array.from(eventsByDay.entries()).map(([dateStr, times]) => {
    if (times.length < 2) return { date: dateStr, avgMinutesBetweenCycles: null };
    let totalMinutes = 0;
    for (let i = 1; i < times.length; i++) {
      totalMinutes += (times[i].getTime() - times[i - 1].getTime()) / 60000;
    }
    return { date: dateStr, avgMinutesBetweenCycles: Math.round(totalMinutes / (times.length - 1)) };
  }).sort((a, b) => b.date.localeCompare(a.date));

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
