"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, LineChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery100Icon, SignalIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

// 1. NEON COLORS CONFIGURATION
// These are bright colors that are easy to see on black backgrounds
const COLORS = {
  level: "#06b6d4",   // Cyan (Bright Blue)
  trigger: "#84cc16", // Lime (Bright Green)
  alarm: "#d946ef"    // Fuchsia (Bright Pink)
};

export default function DashboardClient({ latest, daily, history }: any) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const dataRefresher = setInterval(() => router.refresh(), 30000);
    return () => { clearInterval(timer); clearInterval(dataRefresher); };
  }, [router]);

  // Data Calculations
  const lastSeen = new Date(latest.created_at).getTime();
  const minsAgo = Math.floor((now - lastSeen) / 60000);
  const isOnline = minsAgo < 15;
  const isHighWater = latest.water_level_inches > 6.0;
  const systemHealthy = isOnline && !isHighWater && latest.ac_power_on;

  // Chart Data Formatting
  const chartData = history?.map((r: any) => ({
    Time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    "Water Level": r.water_level_inches,
    "Pump Trigger": 4.5,
    "High Alarm": 6.0
  })) || [];

  return (
    <main className="h-screen bg-slate-950 text-slate-200 p-2 md:p-4 flex flex-col overflow-hidden font-sans">
      
      {/* 1. HEADER & STATUS */}
      <div className="flex-none mb-3">
        {!isOnline && (
          <div className="bg-rose-600 text-white font-bold text-center py-2 mb-2 rounded animate-pulse flex items-center justify-center gap-2 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5" /> OFFLINE ({minsAgo}m)
          </div>
        )}
        <div className={`rounded-lg px-4 py-2 border-l-4 ${systemHealthy ? "bg-emerald-950/40 border-emerald-500" : "bg-rose-950/40 border-rose-500"}`}>
          <Flex justifyContent="between">
            <div>
              <h2 className={`text-xl font-bold ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
                {systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED"}
              </h2>
              <Text className="text-slate-400 text-xs">Updated: {new Date(latest.created_at).toLocaleTimeString()}</Text>
            </div>
            {latest.pump_running && <Badge color="cyan" className="animate-pulse">PUMP RUNNING</Badge>}
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

      {/* 3. CHART & STATS (Fills remaining space) */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        <Card className="bg-slate-900 border-slate-800 ring-0 lg:col-span-3 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2">
            <Title className="text-white">Live Water Level</Title>
            {/* Custom Legend matches the Hex Codes exactly */}
            <div className="flex gap-4 text-[10px] uppercase tracking-widest font-bold">
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.level}}></span> Level</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.trigger}}></span> Trigger</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.alarm}}></span> Alarm</span>
            </div>
          </div>
          
          <div className="flex-grow min-h-0">
            <LineChart
              className="h-full w-full custom-chart"
              data={chartData}
              index="Time"
              categories={["Water Level", "Pump Trigger", "High Alarm"]}
              colors={["cyan", "lime", "fuchsia"]} // Matches our COLORS object
              showLegend={false}
              showGridLines={true}
              yAxisWidth={35}
              minValue={0}
              maxValue={10}
              autoMinValue={false}
              showAnimation={false}
              connectNulls={true}
            />
          </div>
        </Card>

        {/* DAILY STATS */}
        <Card className="bg-slate-900 border-slate-800 ring-0 p-4 flex flex-col justify-center">
          <Title className="text-white text-sm border-b border-slate-800 pb-2 mb-2">Daily Totals</Title>
          <List className="mt-0">
            <ListItem className="py-3 border-slate-800">
                <span className="text-slate-400 text-sm">Cycles</span>
                <span className="text-white font-mono text-2xl">{daily?.total_cycles || 0}</span>
            </ListItem>
            <ListItem className="py-3 border-slate-800">
                <span className="text-slate-400 text-sm">Gallons</span>
                <span className="text-white font-mono text-2xl">{daily?.total_gallons?.toFixed(0) || 0}</span>
            </ListItem>
          </List>
          <Text className="text-slate-600 text-xs text-center mt-auto pt-2">Resets at midnight</Text>
        </Card>
      </div>
    </main>
  );
}
