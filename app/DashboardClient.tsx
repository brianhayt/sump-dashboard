"use client"; // This line is the fix!

import { Card, AreaChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery50Icon, SignalIcon, WrenchScrewdriverIcon, ClockIcon } from "@heroicons/react/24/solid";

interface DashboardProps {
  latest: any;
  daily: any;
  history: any[];
}

export default function DashboardClient({ latest, daily, history }: DashboardProps) {
  const isOnline = (Date.now() - new Date(latest.created_at).getTime()) < 15 * 60 * 1000;
  const isHighWater = latest.water_level_inches > 10;
  const isPowerOn = latest.ac_power_on;
  const isPumpRunning = latest.pump_running;
  
  const systemHealthy = isOnline && !isHighWater && isPowerOn && latest.battery_voltage > 11.5;
  const statusText = systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED";

  const chartData = history?.map(r => ({
    Time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    "Level": r.water_level_inches
  })) || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className={`rounded-lg p-4 mb-6 border-l-4 ${systemHealthy ? "bg-emerald-900/30 border-emerald-500" : "bg-rose-900/30 border-rose-500"}`}>
        <Flex justifyContent="between" alignItems="center">
          <div>
            <h2 className={`text-lg font-bold tracking-wider ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {statusText}
            </h2>
            <p className="text-slate-400 text-sm mt-1">Last updated: {new Date(latest.created_at).toLocaleTimeString()}</p>
          </div>
          {isPumpRunning && <Badge color="blue" className="animate-pulse">PUMP RUNNING</Badge>}
        </Flex>
      </div>

      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Water Level</Text>
          <Flex justifyContent="start" alignItems="baseline" className="space-x-2 mt-2">
            <Metric className="text-white">{latest.water_level_inches.toFixed(1)}&quot;</Metric>
            <Text className="text-slate-500">inches</Text>
          </Flex>
          <ProgressBar value={(latest.water_level_inches / 15) * 100} color={isHighWater ? "red" : "blue"} className="mt-3" />
        </Card>

        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Battery</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <Battery50Icon className="h-8 w-8 text-slate-500" />
            <Metric className="text-white">{latest.battery_voltage.toFixed(1)} V</Metric>
          </Flex>
        </Card>

        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Mains Power</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <BoltIcon className={`h-8 w-8 ${isPowerOn ? "text-emerald-500" : "text-rose-500"}`} />
            <Metric className={isPowerOn ? "text-white" : "text-rose-500"}>{isPowerOn ? "Online" : "OFFLINE"}</Metric>
          </Flex>
        </Card>

        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">WiFi Signal</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <SignalIcon className="h-8 w-8 text-slate-500" />
            <Metric className="text-white">{latest.wifi_rssi || -99} dBm</Metric>
          </Flex>
        </Card>
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 ring-0 h-full">
            <Title className="text-white">24-Hour Trends</Title>
            <AreaChart
              className="h-72 mt-4"
              data={chartData}
              index="Time"
              categories={["Level"]}
              colors={["blue"]}
              showLegend={false}
              showGridLines={false}
              yAxisWidth={40}
            />
          </Card>
        </div>
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Title className="text-white mb-4">Daily Performance</Title>
          <List>
            <ListItem><span className="text-slate-400">Cycles</span><span className="text-white font-bold">{daily?.total_cycles || 0}</span></ListItem>
            <ListItem><span className="text-slate-400">Gallons</span><span className="text-white font-bold">{daily?.total_gallons?.toFixed(1) || 0} gal</span></ListItem>
          </List>
        </Card>
      </div>
    </main>
  );
}