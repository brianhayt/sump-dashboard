"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Title, Text, Metric, Flex, BarChart, Grid } from "@tremor/react";
import { ArrowLeftIcon, CalendarDaysIcon, ChartBarIcon } from "@heroicons/react/24/solid";

interface DaySummary {
  date: string;
  total_cycles: number;
  total_gallons: number;
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
              <Metric className="text-white">{weeklyAvgPerDay.cycles.toFixed(1)}</Metric>
              <Text className="text-slate-500 text-sm">cycles / {Math.round(weeklyAvgPerDay.gallons)} gal</Text>
            </Card>
          </Grid>

          {/* Weekly Bar Chart */}
          <Card className="bg-slate-900 border-slate-800 ring-0 mb-6">
            <Title className="text-white mb-4">Last 7 Days</Title>
            {chartData.length > 0 ? (
              <BarChart
                className="h-72"
                data={chartData}
                index="date"
                categories={["Cycles", "Gallons"]}
                colors={["cyan", "lime"]}
                yAxisWidth={40}
                showAnimation={false}
              />
            ) : (
              <Text className="text-slate-500 text-center py-10">No data available for the past week</Text>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* Monthly Heatmap */}
          <Card className="bg-slate-900 border-slate-800 ring-0 mb-6">
            <Title className="text-white mb-4">Last 30 Days Activity</Title>
            {/* Constrained width container for heatmap */}
            <div className="max-w-md">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <span>Less</span>
                <div className="flex gap-1">
                  {[0.1, 0.3, 0.5, 0.7, 1].map((intensity, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: getHeatColor(intensity) }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs text-slate-600 py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {heatmapData.map((day, index) => (
                  <div
                    key={index}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-sm cursor-default ${
                      day.isEmpty ? "bg-slate-800/50" : ""
                    }`}
                    style={
                      !day.isEmpty
                        ? { backgroundColor: getHeatColor((day.gallons || 0) / maxGallons) }
                      : undefined
                  }
                  title={
                    day.isEmpty
                      ? ""
                      : `${day.date}: ${day.gallons} gal, ${day.cycles} cycles`
                  }
                />
              ))}
              </div>
            </div>
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
