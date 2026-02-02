"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, LineChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery100Icon, SignalIcon, ExclamationTriangleIcon, ArrowsPointingOutIcon, XMarkIcon, ChartBarSquareIcon } from "@heroicons/react/24/solid";

// NEON COLORS CONFIGURATION
const COLORS = {
  level: "#06b6d4",   // Cyan (Bright Blue)
  trigger: "#84cc16", // Lime (Bright Green)
  alarm: "#d946ef"    // Fuchsia (Bright Pink)
};

// Time range options in hours
const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

export default function DashboardClient({ latest, daily, history, events }: any) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [selectedRange, setSelectedRange] = useState(1); // Default to 1h
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const dataRefresher = setInterval(() => router.refresh(), 30000);
    return () => { clearInterval(timer); clearInterval(dataRefresher); };
  }, [router]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Data Calculations
  const lastSeen = new Date(latest.created_at).getTime();
  const minsAgo = Math.floor((now - lastSeen) / 60000);
  const isOnline = minsAgo < 15;
  const isHighWater = latest.water_level_inches > 6.0;
  const systemHealthy = isOnline && !isHighWater && latest.ac_power_on;

  // Filter history by selected time range (relative to most recent reading, not browser time)
  const mostRecentTime = history?.length > 0
    ? new Date(history[history.length - 1].created_at).getTime()
    : Date.now();

  const filteredHistory = history?.filter((r: any) => {
    const readingTime = new Date(r.created_at).getTime();
    const cutoff = mostRecentTime - selectedRange * 60 * 60 * 1000;
    return readingTime >= cutoff;
  }) || [];

  // Chart Data Formatting (category names include units for tooltip display)
  // Show all data points - no downsampling
  const chartData = filteredHistory.map((r: any) => {
    const date = new Date(r.created_at);
    return {
      Time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      "Level (in)": r.water_level_inches,
      "Trigger (in)": 4.5,
      "Alarm (in)": 6.0
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-2 md:p-4 flex flex-col font-sans">
      
      {/* 1. HEADER & STATUS */}
      <div className="flex-none mb-3">
        {!isOnline && (
          <div className="bg-rose-600 text-white font-bold text-center py-2 mb-2 rounded animate-pulse flex items-center justify-center gap-2 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5" /> OFFLINE ({minsAgo}m)
          </div>
        )}
        <div className={`rounded-lg px-4 py-2 border-l-4 ${systemHealthy ? "bg-emerald-950/40 border-emerald-500" : "bg-rose-950/40 border-rose-500"}`}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <h2 className={`text-xl font-bold ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
                {systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED"}
              </h2>
              <Text className="text-slate-400 text-xs">Updated: {new Date(latest.created_at).toLocaleTimeString()}</Text>
            </div>
            <div className="flex items-center gap-2">
              {latest.pump_running && <Badge color="cyan" className="animate-pulse">PUMP RUNNING</Badge>}
              <Link
                href="/stats"
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
              >
                <ChartBarSquareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Stats</span>
              </Link>
            </div>
          </Flex>
        </div>
      </div>

      {/* 2. METRICS ROW */}
      <Grid numItems={2} numItemsSm={4} className="gap-3 flex-none mb-3">
        {/* Water Level */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Level</Text>
          <Metric className="text-white text-2xl">{latest.water_level_inches.toFixed(1)}<span className="text-sm text-slate-500 ml-1">in</span></Metric>
          <ProgressBar value={(latest.water_level_inches / 8) * 100} color={isHighWater ? "fuchsia" : "cyan"} className="mt-2 h-2" />
        </Card>

        {/* Battery */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Battery</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <Battery100Icon className={`h-5 w-5 ${latest.battery_voltage < 11.5 ? "text-rose-500" : "text-emerald-500"}`} />
            <Metric className="text-white text-2xl">{latest.battery_voltage.toFixed(1)}V</Metric>
          </Flex>
        </Card>

        {/* AC Power */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Power</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <BoltIcon className={`h-5 w-5 ${latest.ac_power_on ? "text-emerald-500" : "text-rose-500"}`} />
            <span className={`text-xl font-bold ${latest.ac_power_on ? "text-white" : "text-rose-500"}`}>{latest.ac_power_on ? "ONLINE" : "OUTAGE"}</span>
          </Flex>
        </Card>

        {/* Signal */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Signal</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <SignalIcon className={`h-5 w-5 ${latest.wifi_rssi > -75 ? "text-emerald-500" : "text-yellow-500"}`} />
            <Metric className="text-white text-xl">{latest.wifi_rssi} <span className="text-xs text-slate-500">dBm</span></Metric>
          </Flex>
        </Card>
      </Grid>

      {/* 3. CHART & STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-slate-900 border-slate-800 ring-0 lg:col-span-3 flex flex-col">
          {/* Chart Header - Responsive Layout */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            {/* Title + Time Range */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <Title className="text-white text-sm sm:text-base whitespace-nowrap">Water Level</Title>
              {/* Time Range Selector */}
              <div className="flex gap-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.hours}
                    onClick={() => setSelectedRange(range.hours)}
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded transition-colors ${
                      selectedRange === range.hours
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Legend + Fullscreen */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
              {/* Custom Legend - Compact on mobile */}
              <div className="flex gap-2 sm:gap-4 text-[8px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest font-bold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{backgroundColor: COLORS.level}}></span> Level</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{backgroundColor: COLORS.trigger}}></span> Trigger</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{backgroundColor: COLORS.alarm}}></span> Alarm</span>
              </div>
              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Fullscreen"
              >
                <ArrowsPointingOutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
            <LineChart
              className="h-full w-full custom-chart"
              data={chartData}
              index="Time"
              categories={["Level (in)", "Trigger (in)", "Alarm (in)"]}
              colors={["cyan", "lime", "fuchsia"]}
              showLegend={false}
              showGridLines={true}
              yAxisWidth={30}
              minValue={0}
              maxValue={10}
              autoMinValue={false}
              showAnimation={false}
              connectNulls={true}
            />
          </div>
        </Card>

        {/* DAILY STATS & EVENTS - Horizontal on mobile, vertical on desktop */}
        <div className="flex flex-row lg:flex-col gap-2 sm:gap-4">
          <Card className="bg-slate-900 border-slate-800 ring-0 p-2 sm:p-4 flex-1">
            <Title className="text-white text-xs sm:text-sm border-b border-slate-800 pb-1 sm:pb-2 mb-1 sm:mb-2">Daily Totals</Title>
            <List className="mt-0">
              <ListItem className="py-1 sm:py-3 border-slate-800">
                <span className="text-slate-400 text-xs sm:text-sm">Cycles</span>
                <span className="text-white font-mono text-lg sm:text-2xl">{daily?.total_cycles || 0}</span>
              </ListItem>
              <ListItem className="py-1 sm:py-3 border-slate-800">
                <span className="text-slate-400 text-xs sm:text-sm">Gallons</span>
                <span className="text-white font-mono text-lg sm:text-2xl">{daily?.total_gallons?.toFixed(0) || 0}</span>
              </ListItem>
            </List>
            <Text className="text-slate-600 text-[10px] sm:text-xs text-center mt-1 sm:mt-2">Resets at midnight</Text>
          </Card>

          {/* Event History */}
          <Card className="bg-slate-900 border-slate-800 ring-0 p-2 sm:p-4 flex-1">
            <Title className="text-white text-xs sm:text-sm border-b border-slate-800 pb-1 sm:pb-2 mb-1 sm:mb-2">Recent Events</Title>
            <div className="overflow-y-auto max-h-24 sm:max-h-40">
              {events && events.length > 0 ? (
                <List className="mt-0">
                  {events.slice(0, 5).map((event: any, index: number) => {
                    const eventDate = new Date(event.created_at);
                    const today = new Date();
                    const isToday = eventDate.toDateString() === today.toDateString();
                    const timeStr = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = isToday ? timeStr : `${eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;

                    return (
                      <ListItem key={event.id || index} className="py-1 sm:py-2 border-slate-800">
                        <span className="text-slate-400 text-[10px] sm:text-xs truncate">{event.event_type?.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500 text-[10px] sm:text-xs">{dateStr}</span>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Text className="text-slate-500 text-xs text-center">No recent events</Text>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Fullscreen Chart Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Title className="text-white text-2xl">Live Water Level</Title>
              {/* Time Range Selector */}
              <div className="flex gap-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.hours}
                    onClick={() => setSelectedRange(range.hours)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedRange === range.hours
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              {/* Legend */}
              <div className="flex gap-6 text-xs uppercase tracking-widest font-bold">
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm" style={{backgroundColor: COLORS.level}}></span> Level</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm" style={{backgroundColor: COLORS.trigger}}></span> Trigger</span>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-sm" style={{backgroundColor: COLORS.alarm}}></span> Alarm</span>
              </div>
              {/* Current Level */}
              <div className="text-cyan-400 text-xl font-mono">
                {latest.water_level_inches.toFixed(1)}"
              </div>
              {/* Close Button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="flex-grow">
            <LineChart
              className="h-full w-full custom-chart"
              data={chartData}
              index="Time"
              categories={["Level (in)", "Trigger (in)", "Alarm (in)"]}
              colors={["cyan", "lime", "fuchsia"]}
              showLegend={false}
              showGridLines={true}
              yAxisWidth={50}
              minValue={0}
              maxValue={10}
              autoMinValue={false}
              showAnimation={false}
              connectNulls={true}
            />
          </div>
          <Text className="text-slate-600 text-center mt-2">Press Escape or click X to exit fullscreen</Text>
        </div>
      )}
    </main>
  );
}
