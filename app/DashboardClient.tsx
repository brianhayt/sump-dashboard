"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, LineChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery100Icon, SignalIcon, ExclamationTriangleIcon, ClockIcon } from "@heroicons/react/24/solid";

// Define strict colors so the legend and chart are guaranteed to match
const COLORS = {
  level: "#3b82f6",  // Blue-500
  trigger: "#10b981", // Emerald-500
  alarm: "#ef4444"    // Red-500
};

export default function DashboardClient({ latest, daily, history }: any) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const dataRefresher = setInterval(() => router.refresh(), 30000);
    return () => { clearInterval(timer); clearInterval(dataRefresher); };
  }, [router]);

  const lastSeen = new Date(latest.created_at).getTime();
  const minsAgo = Math.floor((now - lastSeen) / 60000);
  const isOnline = minsAgo < 15;
  const systemHealthy = isOnline && latest.water_level_inches < 6.0 && latest.ac_power_on;

  const chartData = history?.map((r: any) => ({
    Time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    "Water Level": r.water_level_inches,
    "Pump Trigger": 4.5,
    "High Alarm": 6.0
  })) || [];

  return (
    <main className="h-screen bg-slate-950 text-slate-200 p-2 md:p-6 flex flex-col overflow-hidden font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex-none mb-4">
        {!isOnline && (
          <div className="bg-rose-600 text-white font-bold text-center py-2 mb-2 rounded animate-pulse flex items-center justify-center gap-2 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5" /> OFFLINE ({minsAgo}m)
          </div>
        )}
        <div className={`rounded-lg px-4 py-3 border-l-4 ${systemHealthy ? "bg-emerald-950/40 border-emerald-500" : "bg-rose-950/40 border-rose-500"}`}>
          <Flex justifyContent="between">
            <div>
              <h2 className={`text-xl font-bold ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
                {systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED"}
              </h2>
              <Text className="text-slate-400 text-xs mt-1">Updated: {new Date(latest.created_at).toLocaleTimeString()}</Text>
            </div>
            {latest.pump_running && <Badge color="blue" className="animate-pulse">PUMP RUNNING</Badge>}
          </Flex>
        </div>
      </div>

      {/* METRICS GRID */}
      <Grid numItems={2} numItemsSm={4} className="gap-3 flex-none mb-4">
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Level</Text>
          <Metric className="text-white text-2xl">{latest.water_level_inches.toFixed(1)}<span className="text-sm text-slate-500 ml-1">in</span></Metric>
          <ProgressBar value={(latest.water_level_inches / 8) * 100} color={latest.water_level_inches > 6 ? "red" : "blue"} className="mt-2 h-2" />
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Battery</Text>
          <Metric className="text-white text-2xl">{latest.battery_voltage.toFixed(1)}V</Metric>
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Power</Text>
          <span className={`text-xl font-bold ${latest.ac_power_on ? "text-emerald-500" : "text-rose-500"}`}>{latest.ac_power_on ? "AC ONLINE" : "OUTAGE"}</span>
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase">Signal</Text>
          <Metric className="text-white text-xl">{latest.wifi_rssi} dBm</Metric>
        </Card>
      </Grid>

      {/* CHART SECTION */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        <Card className="bg-slate-900 border-slate-800 ring-0 lg:col-span-3 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <Title className="text-white">Water Level (24h)</Title>
            {/* Legend with Hex codes to match chart exactly */}
            <div className="flex gap-4 text-[10px] uppercase tracking-widest font-bold">
               <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.level}}></span> Level</span>
               <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.trigger}}></span> Trigger</span>
               <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: COLORS.alarm}}></span> Alarm</span>
            </div>
          </div>
          
          <div className="flex-grow min-h-0">
            <LineChart
              className="h-full w-full custom-chart"
              data={chartData}
              index="Time"
              categories={["Water Level", "Pump Trigger", "High Alarm"]}
              colors={["blue", "emerald", "rose"]}
              showLegend={false}
              showGridLines={true}
              yAxisWidth={35}
              minValue={0}
              maxValue={10}
              showAnimation={false}
              connectNulls={true}
            />
          </div>
        </Card>

        {/* COMPACT STATS */}
        <Card className="bg-slate-900 border-slate-800 ring-0 p-4">
          <Title className="text-white text-sm border-b border-slate-800 pb-2 mb-4">Daily Stats</Title>
          <List>
            <ListItem className="py-2 border-slate-800 text-sm">
                <span className="text-slate-400">Cycles</span>
                <span className="text-white font-mono font-bold">{daily?.total_cycles || 0}</span>
            </ListItem>
            <ListItem className="py-2 border-slate-800 text-sm">
                <span className="text-slate-400">Gallons</span>
                <span className="text-white font-mono font-bold">{daily?.total_gallons?.toFixed(1) || 0}</span>
            </ListItem>
          </List>
        </Card>
      </div>
    </main>
  );
}
