"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Title, Text, Metric, Flex, BarChart, Grid, Badge } from "@tremor/react";
import { ArrowLeftIcon, InformationCircleIcon, ChartBarIcon, ClockIcon } from "@heroicons/react/24/solid";

interface DaySummary {
  date: string;
  total_cycles: number;
  total_gallons: number;
  avg_temperature_f: number | null;
  avg_humidity_pct: number | null;
}

interface Event {
  id: string;
  event_type: string;
  created_at: string;
  message?: string;
}

interface PumpInterval {
  date: string;
  avgMinutesBetweenCycles: number | null;
}

interface StatsClientProps {
  weeklyData: DaySummary[];
  monthlyData: DaySummary[];
  busiestDay: DaySummary | null;
  mostCyclesDay: DaySummary | null;
  allTimeTotals: { totalCycles: number; totalGallons: number };
  recentEvents: Event[];
  pumpIntervals: PumpInterval[];
}

export default function StatsClient({
  weeklyData,
  monthlyData,
  allTimeTotals,
  pumpIntervals,
}: StatsClientProps) {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");

  const weeklyTotals = weeklyData.reduce(
    (acc, day) => ({
      cycles: acc.cycles + (day.total_cycles || 0),
      gallons: acc.gallons + (day.total_gallons || 0),
    }),
    { cycles: 0, gallons: 0 }
  );

  const avgHumid = weeklyData.length > 0 
    ? weeklyData.reduce((acc, d) => acc + (d.avg_humidity_pct || 0), 0) / weeklyData.length 
    : 0;

  const chartData = weeklyData.map((day) => ({
    date: formatDateShort(day.date),
    Gallons: Math.round(day.total_gallons || 0),
  }));

  const maxGallons = Math.max(...monthlyData.map((d) => d.total_gallons || 0), 1);
  const heatmapData = generateHeatmapData(monthlyData);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <Flex className="mb-8 items-center justify-between">
          <Title className="text-3xl font-bold text-white">System Statistics</Title>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
             <button onClick={() => setViewMode("weekly")} className={`px-4 py-2 rounded-md text-sm ${viewMode === 'weekly' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Weekly</button>
             <button onClick={() => setViewMode("monthly")} className={`px-4 py-2 rounded-md text-sm ${viewMode === 'monthly' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Monthly</button>
          </div>
        </Flex>

        {viewMode === "weekly" ? (
          <>
            <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4 mb-6">
              <Card className="bg-slate-900 border-slate-800 ring-0 border-b-2 border-cyan-500">
                <Text className="text-slate-400 text-xs uppercase font-semibold">Total Gallons</Text>
                <Metric className="text-white">{Math.round(weeklyTotals.gallons).toLocaleString()}</Metric>
              </Card>
              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Text className="text-slate-400 text-xs uppercase font-semibold">Pump Efficiency</Text>
                <Metric className="text-white">{(weeklyTotals.gallons / (weeklyTotals.cycles || 1)).toFixed(1)} <span className="text-xs text-slate-500">gal/cyc</span></Metric>
              </Card>
              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Text className="text-slate-400 text-xs uppercase font-semibold">Total Cycles</Text>
                <Metric className="text-white">{weeklyTotals.cycles.toLocaleString()}</Metric>
              </Card>
              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Text className="text-slate-400 text-xs uppercase font-semibold">Avg Humidity</Text>
                <Metric className={avgHumid >= 55 ? "text-amber-400" : "text-emerald-400"}>{Math.round(avgHumid)}%</Metric>
              </Card>
            </Grid>

            <Card className="bg-slate-900 border-slate-800 ring-0 mb-6">
              <Title className="text-white mb-6">Daily Water Volume (Gallons)</Title>
              <BarChart className="h-80" data={chartData} index="date" categories={["Gallons"]} colors={["cyan"]} yAxisWidth={60} />
            </Card>

            <Grid numItems={1} numItemsMd={2} className="gap-6">
               <Card className="bg-slate-900 border-slate-800 ring-0">
                <Title className="text-white text-sm mb-4">Pit Environment (7d Avg)</Title>
                <Flex className="mb-4"><Text>Temperature</Text><Text className="text-white">{weeklyData[0]?.avg_temperature_f?.toFixed(1) || "--"}°F</Text></Flex>
                <Flex><Text>Humidity Status</Text><Badge color={avgHumid >= 55 ? "amber" : "emerald"}>{avgHumid >= 55 ? "High" : "Normal"}</Badge></Flex>
              </Card>

              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Title className="text-white text-sm mb-4">Pump Cycle Timing</Title>
                <div className="divide-y divide-slate-800 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {pumpIntervals.map((d) => (
                    <div key={d.date} className="flex justify-between py-2">
                      <span className="text-slate-400 text-sm">{formatDateShort(d.date)}</span>
                      <span className="text-white font-mono text-sm font-bold">{d.avgMinutesBetweenCycles ? `${d.avgMinutesBetweenCycles} min` : "---"}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Grid>
          </>
        ) : (
          <Card className="bg-slate-900 border-slate-800 ring-0 mb-6 overflow-visible">
            <Title className="text-white mb-8">30-Day Activity Heatmap</Title>
            <div className="grid gap-2 mx-auto w-fit grid-cols-7">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="text-[10px] text-slate-600 text-center uppercase font-bold">{d}</div>)}
              {heatmapData.map((day, index) => (
                <div key={index} className="group relative">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-md flex items-center justify-center border-2 ${day.isEmpty ? "border-transparent bg-slate-800/10" : "border-slate-950 hover:border-white hover:scale-110 cursor-pointer"}`}
                       style={!day.isEmpty ? { backgroundColor: getHeatColorImproved((day.gallons || 0) / maxGallons) } : undefined}>
                    {!day.isEmpty && <span className="text-[10px] text-white/30">{new Date(day.date + "T00:00:00").getDate()}</span>}
                  </div>
                  {!day.isEmpty && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-50 w-36 bg-slate-800 border border-slate-700 p-2 rounded shadow-2xl pointer-events-none">
                      <p className="text-[10px] font-bold text-cyan-400 border-b border-slate-700 mb-1">{formatDateShort(day.date)}</p>
                      <p className="text-[10px] text-white leading-tight"><b>{Math.round(day.gallons)}</b> Gallons</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function getHeatColorImproved(intensity: number) {
  if (intensity <= 0) return "#1e293b";
  if (intensity < 0.2) return "#134e4a";
  if (intensity < 0.5) return "#0d9488";
  if (intensity < 0.8) return "#14b8a6";
  return "#5eead4";
}

function generateHeatmapData(monthlyData: DaySummary[]) {
  const result = [];
  const dataMap = new Map(monthlyData.map((d) => [d.date, d]));
  const startDate = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
  const alignedStart = new Date(startDate);
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

  for (let i = 0; i < 35; i++) {
    const d = new Date(alignedStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayData = dataMap.get(dateStr);
    result.push({ date: dateStr, cycles: dayData?.total_cycles || 0, gallons: dayData?.total_gallons || 0, isEmpty: !dayData });
  }
  return result;
}
