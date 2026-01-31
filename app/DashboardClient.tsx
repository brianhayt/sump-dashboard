"use client";

import { Card, AreaChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery50Icon, Battery100Icon, SignalIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface DashboardProps {
  latest: any;
  daily: any;
  history: any[];
}

export default function DashboardClient({ latest, daily, history }: DashboardProps) {
  // 1. Data Processing
  const now = Date.now();
  const lastSeen = new Date(latest.created_at).getTime();
  const minsAgo = Math.floor((now - lastSeen) / 60000);
  
  const isOnline = minsAgo < 15; // "Offline" if no data for 15 mins
  const isHighWater = latest.water_level_inches > 6.0; // Matches new Arduino config
  const isPowerOn = latest.ac_power_on;
  const isPumpRunning = latest.pump_running;
  
  // Battery Logic: >13V is Charging, <12V is Discharging/Resting
  const isCharging = latest.battery_voltage > 13.0;
  const isLowBattery = latest.battery_voltage < 11.5;

  const systemHealthy = isOnline && !isHighWater && isPowerOn && !isLowBattery;
  
  // 2. Chart Data Formatting
  const chartData = history?.map(r => ({
    Time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    "Water Level": r.water_level_inches,
    "Pump Trigger": 4.5, // Reference Line
    "High Alarm": 6.0    // Reference Line
  })) || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-20">
      
      {/* OFFLINE BANNER (The "Dead Man's Switch" Visual) */}
      {!isOnline && (
        <div className="bg-rose-600 text-white font-bold text-center p-3 mb-6 rounded animate-pulse flex items-center justify-center gap-2">
          <ExclamationTriangleIcon className="h-6 w-6" />
          SYSTEM OFFLINE: No data received for {minsAgo} minutes
        </div>
      )}

      {/* HEADER */}
      <div className={`rounded-lg p-4 mb-6 border-l-4 transition-colors ${systemHealthy ? "bg-emerald-900/20 border-emerald-500" : "bg-rose-900/20 border-rose-500"}`}>
        <Flex justifyContent="between" alignItems="center">
          <div>
            <h2 className={`text-lg font-bold tracking-wider ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED"}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Last updated: {new Date(latest.created_at).toLocaleDateString()} at {new Date(latest.created_at).toLocaleTimeString()}
            </p>
          </div>
          {isPumpRunning && <Badge color="blue" className="animate-pulse">PUMP RUNNING</Badge>}
        </Flex>
      </div>

      {/* METRIC GRID */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4 mb-6">
        
        {/* Water Level */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Water Level</Text>
          <Flex justifyContent="start" alignItems="baseline" className="space-x-2 mt-2">
            <Metric className="text-white">{latest.water_level_inches.toFixed(1)}&quot;</Metric>
            <Text className="text-slate-500">inches</Text>
          </Flex>
          <ProgressBar value={(latest.water_level_inches / 8) * 100} color={isHighWater ? "red" : "blue"} className="mt-3" />
        </Card>

        {/* Battery */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Battery Status</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            {isCharging ? (
              <BoltIcon className="h-8 w-8 text-yellow-400" /> // Charging Icon
            ) : isLowBattery ? (
              <Battery50Icon className="h-8 w-8 text-red-500" />
            ) : (
              <Battery100Icon className="h-8 w-8 text-emerald-500" />
            )}
            <div>
              <Metric className="text-white">{latest.battery_voltage.toFixed(1)} V</Metric>
              <Text className="text-xs text-slate-500">
                {isCharging ? "Charging" : "Discharging"}
              </Text>
            </div>
          </Flex>
        </Card>

        {/* Mains Power */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Mains Power</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <BoltIcon className={`h-8 w-8 ${isPowerOn ? "text-emerald-500" : "text-rose-500"}`} />
            <Metric className={isPowerOn ? "text-white" : "text-rose-500"}>{isPowerOn ? "Online" : "OUTAGE"}</Metric>
          </Flex>
        </Card>

        {/* WiFi */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">WiFi Signal</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <SignalIcon className={`h-8 w-8 ${latest.wifi_rssi > -70 ? "text-emerald-500" : "text-yellow-500"}`} />
            <Metric className="text-white">{latest.wifi_rssi || -99} dBm</Metric>
          </Flex>
        </Card>
      </Grid>

      {/* CHARTS & STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 ring-0 h-full">
            <Title className="text-white">24-Hour Water Level</Title>
            <AreaChart
              className="h-72 mt-4"
              data={chartData}
              index="Time"
              categories={["Water Level", "Pump Trigger"]}
              colors={["blue", "emerald"]}
              showLegend={true}
              showGridLines={false}
              yAxisWidth={40}
              minValue={0}
              maxValue={10} // Fixed scale makes it easier to read
            />
          </Card>
        </div>
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Title className="text-white mb-4">Daily Performance</Title>
          <List>
            <ListItem className="border-slate-800">
                <span className="text-slate-400">Cycles</span>
                <span className="text-white font-bold">{daily?.total_cycles || 0}</span>
            </ListItem>
            <ListItem className="border-slate-800">
                <span className="text-slate-400">Gallons</span>
                <span className="text-white font-bold">{daily?.total_gallons?.toFixed(1) || 0}</span>
            </ListItem>
            <ListItem className="border-slate-800">
                <span className="text-slate-400">Max Level</span>
                <span className="text-white font-bold">{daily?.max_water_level?.toFixed(1) || 0}"</span>
            </ListItem>
          </List>
        </Card>
      </div>
    </main>
  );
}
