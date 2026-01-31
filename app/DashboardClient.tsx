"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, LineChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery50Icon, Battery100Icon, SignalIcon, ExclamationTriangleIcon, ClockIcon } from "@heroicons/react/24/solid";

interface DashboardProps {
  latest: any;
  daily: any;
  history: any[];
}

export default function DashboardClient({ latest, daily, history }: DashboardProps) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  // 1. AUTO-UPDATE & CLOCK LOGIC
  useEffect(() => {
    // Update the "Time Ago" display every minute
    const timer = setInterval(() => setNow(Date.now()), 60000);
    
    // Refresh the data from the server every 30 seconds
    const dataRefresher = setInterval(() => {
      router.refresh(); 
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(dataRefresher);
    };
  }, [router]);

  // 2. DATA PROCESSING
  const lastSeen = new Date(latest.created_at).getTime();
  const minsAgo = Math.floor((now - lastSeen) / 60000);
  
  const isOnline = minsAgo < 15;
  const isHighWater = latest.water_level_inches > 6.0;
  const isPowerOn = latest.ac_power_on;
  const isPumpRunning = latest.pump_running;
  
  const isCharging = latest.battery_voltage > 13.0;
  const isLowBattery = latest.battery_voltage < 11.5;

  const systemHealthy = isOnline && !isHighWater && isPowerOn && !isLowBattery;
  
  // Format Chart Data
  const chartData = history?.map(r => ({
    Time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    "Level": r.water_level_inches,
    "Trigger": 4.5, // Reference Line
    "Alarm": 6.0    // Reference Line
  })) || [];

  return (
    // "h-screen" forces the app to take up exactly the full window height on desktop
    <main className="h-screen bg-slate-950 text-slate-200 p-2 md:p-6 flex flex-col overflow-hidden font-sans">
      
      {/* 1. HEADER SECTION (Compact) */}
      <div className="flex-none mb-4">
        {/* Offline Warning */}
        {!isOnline && (
          <div className="bg-rose-600 text-white font-bold text-center py-2 mb-4 rounded animate-pulse flex items-center justify-center gap-2 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5" />
            OFFLINE ({minsAgo}m)
          </div>
        )}

        <div className={`rounded-lg px-4 py-3 border-l-4 transition-colors ${systemHealthy ? "bg-emerald-950/40 border-emerald-500" : "bg-rose-950/40 border-rose-500"}`}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <h2 className={`text-xl font-bold tracking-tight ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
                {systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED"}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                <ClockIcon className="h-3 w-3" />
                <span>Updated: {new Date(latest.created_at).toLocaleTimeString()} ({minsAgo}m ago)</span>
              </div>
            </div>
            {isPumpRunning && <Badge color="blue" className="animate-pulse">PUMP RUNNING</Badge>}
          </Flex>
        </div>
      </div>

      {/* 2. METRICS GRID (Compact Row) */}
      <Grid numItems={2} numItemsSm={4} className="gap-3 flex-none mb-4">
        {/* Water Level */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase tracking-wider">Level</Text>
          <Flex justifyContent="start" alignItems="baseline" className="gap-1 my-1">
            <Metric className="text-white text-2xl">{latest.water_level_inches.toFixed(1)}</Metric>
            <Text className="text-slate-500 text-sm">in</Text>
          </Flex>
          <ProgressBar value={(latest.water_level_inches / 8) * 100} color={isHighWater ? "red" : "blue"} className="mt-1 h-2" />
        </Card>

        {/* Battery */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase tracking-wider">Battery</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2 my-1">
            {isCharging ? <BoltIcon className="h-6 w-6 text-yellow-400" /> : <Battery100Icon className={`h-6 w-6 ${isLowBattery ? "text-red-500" : "text-emerald-500"}`} />}
            <Metric className="text-white text-2xl">{latest.battery_voltage.toFixed(1)}<span className="text-sm text-slate-500 ml-1">V</span></Metric>
          </Flex>
        </Card>

        {/* Mains Power */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase tracking-wider">AC Power</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2 my-1">
            <BoltIcon className={`h-6 w-6 ${isPowerOn ? "text-emerald-500" : "text-rose-500"}`} />
            <span className={`text-xl font-bold ${isPowerOn ? "text-white" : "text-rose-500"}`}>{isPowerOn ? "ON" : "OFF"}</span>
          </Flex>
        </Card>

        {/* WiFi */}
        <Card className="bg-slate-900 border-slate-800 p-3 ring-0">
          <Text className="text-slate-400 text-xs uppercase tracking-wider">Signal</Text>
          <Flex justifyContent="start" alignItems="center" className="gap-2 my-1">
            <SignalIcon className={`h-6 w-6 ${latest.wifi_rssi > -75 ? "text-emerald-500" : "text-yellow-500"}`} />
            <Metric className="text-white text-xl">{latest.wifi_rssi || -99} <span className="text-sm text-slate-500">dBm</span></Metric>
          </Flex>
        </Card>
      </Grid>

      {/* 3. CHART & STATS (Fills remaining space) */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        
        {/* Main Chart (Takes up 3 columns) */}
        <Card className="bg-slate-900 border-slate-800 ring-0 lg:col-span-3 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2">
            <Title className="text-white">Water Level History (24h)</Title>
            {/* Custom Legend to replace the "Giant Circles" */}
            <div className="flex gap-3 text-xs">
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Level</span>
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Trigger ({4.5}")</span>
               <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Alarm ({6.0}")</span>
            </div>
          </div>
          
          <div className="flex-grow min-h-0">
            <LineChart
              className="h-full w-full"
              data={chartData}
              index="Time"
              categories={["Level", "Trigger", "Alarm"]}
              colors={["blue", "emerald", "rose"]}
              showLegend={false} // We built our own custom one above
              showGridLines={true}
              yAxisWidth={30}
              minValue={0}
              maxValue={10}
              autoMinValue={false}
              showAnimation={false} // Disabling animation stops the "bounce" on refresh
              curveType="monotone"
            />
          </div>
        </Card>

        {/* Daily Stats (Takes up 1 column) */}
        <Card className="bg-slate-900 border-slate-800 ring-0 flex flex-col justify-center">
          <Title className="text-white mb-4 border-b border-slate-800 pb-2">Daily Stats</Title>
          <List className="mt-0">
            <ListItem className="border-slate-800 py-3">
                <span className="text-slate-400 text-sm">Pump Cycles</span>
                <span className="text-white font-mono text-xl">{daily?.total_cycles || 0}</span>
            </ListItem>
            <ListItem className="border-slate-800 py-3">
                <span className="text-slate-400 text-sm">Gallons Pumped</span>
                <span className="text-white font-mono text-xl">{daily?.total_gallons?.toFixed(1) || 0}</span>
            </ListItem>
            <ListItem className="border-slate-800 py-3">
                <span className="text-slate-400 text-sm">Peak Level</span>
                <span className="text-white font-mono text-xl">{daily?.max_water_level?.toFixed(1) || 0}"</span>
            </ListItem>
          </List>
          <div className="mt-auto pt-4 text-center">
            <Text className="text-slate-600 text-xs">Resets at midnight</Text>
          </div>
        </Card>
      </div>
    </main>
  );
}
