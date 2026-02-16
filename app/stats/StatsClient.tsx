"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Title, Text, Metric, Flex, BarChart, Grid } from "@tremor/react";
import { ArrowLeftIcon, CalendarDaysIcon, ChartBarIcon } from "@heroicons/react/24/solid";

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

interface StatsClientProps {
  weeklyData: DaySummary[];
  monthlyData: DaySummary[];
  busiestDay: DaySummary | null;
  mostCyclesDay: DaySummary | null;
  allTimeTotals: { totalCycles: number; totalGallons: number };
  recentEvents: Event[];
}

type ViewMode = "weekly" | "monthly";

export default function StatsClient({
  weeklyData,
  monthlyData,
  busiestDay,
  mostCyclesDay,
  allTimeTotals,
  recentEvents,
}: StatsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");

  // Calculate weekly totals
  const weeklyTotals = weeklyData.reduce(
    (acc, day) => ({
      cycles: acc.cycles + (day.total_cycles || 0),
      gallons: acc.gallons + (day.total_gallons || 0),
    }),
    { cycles: 0, gallons: 0 }
  );
  const weeklyAvgPerDay = weeklyData.length > 0
    ? { cycles: weeklyTotals.cycles / weeklyData.length, gallons: weeklyTotals.gallons / weeklyData.length }
    : { cycles: 0, gallons: 0 };

  // Format weekly data for bar chart
  const chartData = weeklyData.map((day) => ({
    date: formatDateShort(day.date),
    Cycles: day.total_cycles || 0,
    Gallons: Math.round(day.total_gallons || 0),
  }));

  // Format weekly temp/humidity data for bar charts
  const envChartData = weeklyData
    .filter((day) => day.avg_temperature_f != null)
    .map((day) => ({
      date: formatDateShort(day.date),
      "Avg Temp (\u00b0F)": Math.round(day.avg_temperature_f || 0),
      "Avg Humidity (%)": Math.round(day.avg_humidity_pct || 0),
    }));

  // Generate heatmap data for last 30 days
  const heatmapData = generateHeatmapData(monthlyData);
  const maxGallons = Math.max(...monthlyData.map((d) => d.total_gallons || 0), 1);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <Title className="text-white text-xl sm:text-2xl">Pump Statistics</Title>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("weekly")}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              viewMode === "weekly"
                ? "bg-cyan-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            Weekly
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              viewMode === "monthly"
                ? "bg-cyan-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Monthly
          </button>
        </div>
      </div>

      {viewMode === "weekly" ? (
        <>
          {/* Weekly Summary Cards */}
          <Grid numItems={1} numItemsSm={3} className="gap-4 mb-6">
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">This Week</Text>
              <Metric className="text-white">{weeklyTotals.cycles}</Metric>
              <Text className="text-slate-500 text-sm">pump cycles</Text>
            </Card>
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">This Week</Text>
              <Metric className="text-white">{Math.round(weeklyTotals.gallons)}</Metric>
              <Text className="text-slate-500 text-sm">gallons pumped</Text>
            </Card>
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">Daily Average</Text>
              <Metric className="text-white">{weeklyAvgPerDay.cycles.toFixed(0)} cycles</Metric>
              <Text className="text-slate-500 text-sm">{Math.round(weeklyAvgPerDay.gallons)} gallons</Text>
            </Card>
          </Grid>

          {/* Weekly Bar Charts - Split into two for clarity */}
          <Grid numItems={1} numItemsMd={2} className="gap-4 mb-6">
            {/* Cycles Chart */}
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Title className="text-white text-sm mb-3">Daily Cycles</Title>
              {chartData.length > 0 ? (
                <BarChart
                  className="h-48"
                  data={chartData}
                  index="date"
                  categories={["Cycles"]}
                  colors={["cyan"]}
                  yAxisWidth={35}
                  showAnimation={false}
                />
              ) : (
                <Text className="text-slate-500 text-center py-8">No data</Text>
              )}
            </Card>

            {/* Gallons Chart */}
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Title className="text-white text-sm mb-3">Daily Gallons</Title>
              {chartData.length > 0 ? (
                <BarChart
                  className="h-48"
                  data={chartData}
                  index="date"
                  categories={["Gallons"]}
                  colors={["emerald"]}
                  yAxisWidth={45}
                  showAnimation={false}
                />
              ) : (
                <Text className="text-slate-500 text-center py-8">No data</Text>
              )}
            </Card>
          </Grid>

          {/* Temperature & Humidity Charts */}
          {envChartData.length > 0 && (
            <Grid numItems={1} numItemsMd={2} className="gap-4 mb-6">
              {/* Temperature Chart */}
              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Title className="text-white text-sm mb-3">Daily Avg Temperature</Title>
                <div className="temp-bar-chart">
                  <BarChart
                    className="h-48"
                    data={envChartData}
                    index="date"
                    categories={["Avg Temp (\u00b0F)"]}
                    colors={["orange"]}
                    yAxisWidth={35}
                    showAnimation={false}
                  />
                </div>
              </Card>

              {/* Humidity Chart */}
              <Card className="bg-slate-900 border-slate-800 ring-0">
                <Title className="text-white text-sm mb-3">Daily Avg Humidity</Title>
                <div className="humidity-bar-chart">
                  <BarChart
                    className="h-48"
                    data={envChartData}
                    index="date"
                    categories={["Avg Humidity (%)"]}
                    colors={["violet"]}
                    yAxisWidth={35}
                    showAnimation={false}
                  />
                </div>
              </Card>
            </Grid>
          )}
        </>
      ) : (
        <>
          {/* Monthly Heatmap - Calendar Style with Day Numbers */}
          <Card className="bg-slate-900 border-slate-800 ring-0 mb-6">
            <Title className="text-white mb-4">Last 30 Days Activity</Title>
            {/* Legend */}
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              <span>Less</span>
              <div className="flex gap-0.5">
                {["#1e293b", "#134e4a", "#0d9488", "#14b8a6", "#2dd4bf"].map((color) => (
                  <div key={color} className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                ))}
              </div>
              <span>More</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid gap-1 mx-auto" style={{ gridTemplateColumns: 'repeat(7, auto)' }}>
              {/* Weekday Headers */}
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-center text-[10px] text-slate-600 font-medium pb-1">
                  {day}
                </div>
              ))}

              {/* Day Cells with Numbers */}
              {heatmapData.map((day, index) => (
                <div
                  key={index}
                  className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-sm flex items-center justify-center cursor-default ${
                    day.isEmpty ? "bg-slate-800/30" : ""
                  }`}
                  style={
                    !day.isEmpty
                      ? { backgroundColor: getHeatColorImproved((day.gallons || 0) / maxGallons) }
                      : undefined
                  }
                  title={
                    day.isEmpty
                      ? ""
                      : `${formatDateLong(day.date)}: ${Math.round(day.gallons)} gal, ${day.cycles} cycles`
                  }
                >
                  {!day.isEmpty && (
                    <span className="text-[11px] sm:text-xs font-medium text-white/80">
                      {new Date(day.date + "T00:00:00").getDate()}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Month Indicator */}
            <Text className="text-slate-600 text-xs mt-3">
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
          </Card>

          {/* Records Section */}
          <Grid numItems={1} numItemsSm={3} className="gap-4 mb-6">
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">Busiest Day</Text>
              {busiestDay ? (
                <>
                  <Metric className="text-white">{Math.round(busiestDay.total_gallons || 0)} gal</Metric>
                  <Text className="text-slate-500 text-sm">{formatDateLong(busiestDay.date)}</Text>
                </>
              ) : (
                <Text className="text-slate-500">No data</Text>
              )}
            </Card>
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">Most Cycles</Text>
              {mostCyclesDay ? (
                <>
                  <Metric className="text-white">{mostCyclesDay.total_cycles} cycles</Metric>
                  <Text className="text-slate-500 text-sm">{formatDateLong(mostCyclesDay.date)}</Text>
                </>
              ) : (
                <Text className="text-slate-500">No data</Text>
              )}
            </Card>
            <Card className="bg-slate-900 border-slate-800 ring-0">
              <Text className="text-slate-400 text-xs uppercase">All Time</Text>
              <Metric className="text-white">{Math.round(allTimeTotals.totalGallons).toLocaleString()} gal</Metric>
              <Text className="text-slate-500 text-sm">{allTimeTotals.totalCycles.toLocaleString()} cycles total</Text>
            </Card>
          </Grid>
        </>
      )}

      {/* Recent Events */}
      <Card className="bg-slate-900 border-slate-800 ring-0">
        <Title className="text-white mb-4">Recent System Events</Title>
        {recentEvents.length > 0 ? (
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0"
              >
                <span className="text-slate-300 text-sm">
                  {formatEventType(event.event_type)}
                </span>
                <span className="text-slate-500 text-xs">
                  {formatEventDate(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Text className="text-slate-500 text-center py-4">No system events recorded</Text>
        )}
      </Card>
    </main>
  );
}

// Helper functions

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Today ${timeStr}`;
  if (isYesterday) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}

function getHeatColor(intensity: number): string {
  // Cyan color scale from dark to bright
  if (intensity <= 0) return "#0f172a"; // slate-900
  if (intensity < 0.25) return "#164e63"; // cyan-900
  if (intensity < 0.5) return "#0e7490"; // cyan-700
  if (intensity < 0.75) return "#06b6d4"; // cyan-500
  return "#22d3ee"; // cyan-400
}

// Improved heat color with teal palette for better visibility
function getHeatColorImproved(intensity: number): string {
  if (intensity <= 0) return "#1e293b";      // slate-800 (visible empty)
  if (intensity < 0.2) return "#134e4a";     // teal-900
  if (intensity < 0.4) return "#0d9488";     // teal-600
  if (intensity < 0.6) return "#14b8a6";     // teal-500
  if (intensity < 0.8) return "#2dd4bf";     // teal-400
  return "#5eead4";                           // teal-300 (brightest)
}

interface HeatmapDay {
  date: string;
  cycles: number;
  gallons: number;
  isEmpty: boolean;
}

function generateHeatmapData(monthlyData: DaySummary[]): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const dataMap = new Map(monthlyData.map((d) => [d.date, d]));

  // Get the date 30 days ago
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Align to start of week (Sunday)
  const alignedStart = new Date(startDate);
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

  // Generate 5 weeks of data (35 days)
  for (let i = 0; i < 35; i++) {
    const date = new Date(alignedStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const data = dataMap.get(dateStr);
    const isInRange = date >= startDate && date <= now;

    result.push({
      date: dateStr,
      cycles: data?.total_cycles || 0,
      gallons: data?.total_gallons || 0,
      isEmpty: !isInRange,
    });
  }

  return result;
}
