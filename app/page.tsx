// app/page.tsx
import { createClient } from '@supabase/supabase-js'
import { Card, AreaChart, Title, Text, Metric, Flex, Badge, BadgeDelta, Grid, Color } from "@tremor/react";
import { ExclamationCircleIcon, BoltIcon, Battery50Icon } from "@heroicons/react/24/solid";

// Initialize Supabase (Use your actual URL and ANON KEY here, or env variables)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. Fetch Data
async function getData() {
  // Get latest reading
  const { data: latest } = await supabase
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get last 24h history for chart
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from('readings')
    .select('created_at, water_level_inches')
    .gt('created_at', yesterday)
    .order('created_at', { ascending: true });

  return { latest, history };
}

export const revalidate = 0; // Disable cache so you always see live data

export default async function Dashboard() {
  const { latest, history } = await getData();

  if (!latest) return <Text>No data available...</Text>;

  // Status Helpers
  const isPowerOn = latest.ac_power_on;
  const isHighWater = latest.water_level_inches > 10; // Match your Arduino threshold
  const isPumpRunning = latest.pump_running;

  // Format data for chart
  const chartData = history?.map(r => ({
    Time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    "Water Level": r.water_level_inches
  })) || [];

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl bg-slate-50 min-h-screen">
      <Title className="mb-6">Sump Pump Monitor</Title>

      <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6 mb-6">
        
        {/* Card 1: Water Level */}
        <Card decoration="top" decorationColor={isHighWater ? "red" : "blue"}>
          <Flex justifyContent="start" className="space-x-4">
            <Metric>{latest.water_level_inches.toFixed(1)}"</Metric>
            <Badge color={isHighWater ? "red" : "blue"}>
              {isHighWater ? "High Water" : "Normal"}
            </Badge>
          </Flex>
          <Text className="mt-2">Current Water Level</Text>
        </Card>

        {/* Card 2: Power Status */}
        <Card decoration="top" decorationColor={isPowerOn ? "emerald" : "red"}>
          <Flex justifyContent="start" className="space-x-4">
            <BoltIcon className={`h-8 w-8 ${isPowerOn ? "text-emerald-500" : "text-red-500"}`} />
            <Metric>{isPowerOn ? "AC OK" : "Power Outage"}</Metric>
          </Flex>
          <Text className="mt-2">Mains Power</Text>
        </Card>

        {/* Card 3: Battery */}
        <Card decoration="top" decorationColor={latest.battery_voltage > 12.0 ? "emerald" : "yellow"}>
          <Flex justifyContent="start" className="space-x-4">
            <Battery50Icon className="h-8 w-8 text-slate-500" />
            <Metric>{latest.battery_voltage.toFixed(1)} V</Metric>
          </Flex>
          <Text className="mt-2">Backup Battery</Text>
        </Card>
      </Grid>

      {/* Chart */}
      <Card>
        <Title>Water Level (Last 24 Hours)</Title>
        <AreaChart
          className="h-72 mt-4"
          data={chartData}
          index="Time"
          categories={["Water Level"]}
          colors={["blue"]}
          showLegend={false}
          yAxisWidth={40}
        />
      </Card>
      
      {/* Footer Info */}
      <Text className="mt-6 text-center text-slate-400">
        Last updated: {new Date(latest.created_at).toLocaleString()}
      </Text>
    </main>
  );
}