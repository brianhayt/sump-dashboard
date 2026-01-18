import { createClient } from '@supabase/supabase-js'
import { Card, AreaChart, Title, Text, Metric, Flex, Badge, Grid, ProgressBar, List, ListItem } from "@tremor/react";
import { BoltIcon, Battery50Icon, SignalIcon, WrenchScrewdriverIcon, ClockIcon } from "@heroicons/react/24/solid";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0; // Ensure data is always fresh

async function getData() {
  // 1. Get latest reading
  const { data: latest } = await supabase
    .from('readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Get today's stats (from daily_summaries if you have them, or calculate/mock for now)
  // For now, we will simulate "Today's Stats" using the latest reading data structure 
  // or fetch from your daily_summaries table if populated.
  const { data: daily } = await supabase
    .from('daily_summaries')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // 3. Get 24h history for chart
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from('readings')
    .select('created_at, water_level_inches')
    .gt('created_at', yesterday)
    .order('created_at', { ascending: true });

  return { latest, daily, history };
}

// Helper: Calculate "Time Ago"
function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export default async function Dashboard() {
  const { latest, daily, history } = await getData();

  if (!latest) return <div className="p-10 text-white">Waiting for data...</div>;

  // --- LOGIC ---
  const isOnline = (Date.now() - new Date(latest.created_at).getTime()) < 15 * 60 * 1000; // 15 mins
  const isHighWater = latest.water_level_inches > 10;
  const isPowerOn = latest.ac_power_on;
  const isPumpRunning = latest.pump_running;
  
  // Status Logic: Green if everything is good, Red if ANY critical issue exists
  const systemHealthy = isOnline && !isHighWater && isPowerOn && latest.battery_voltage > 11.5;
  const statusColor = systemHealthy ? "emerald" : "rose";
  const statusText = systemHealthy ? "SYSTEM NORMAL" : "ATTENTION REQUIRED";

  // Chart Formatting
  const chartData = history?.map(r => ({
    Time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    "Level": r.water_level_inches
  })) || [];

  return (
    // Force Dark Background (bg-slate-950) and Light Text (text-slate-100)
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      
      {/* HEADER: System Status Banner */}
      <div className={`rounded-lg p-4 mb-6 border-l-4 ${systemHealthy ? "bg-emerald-900/30 border-emerald-500" : "bg-rose-900/30 border-rose-500"}`}>
        <Flex justifyContent="between" alignItems="center">
          <div>
            <h2 className={`text-lg font-bold tracking-wider ${systemHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {statusText}
            </h2>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Last updated: {timeAgo(latest.created_at)}
            </p>
          </div>
          {/* Animated Pulse Dot if Pump is Running */}
          {isPumpRunning && (
             <Badge color="blue" className="animate-pulse">PUMP RUNNING</Badge>
          )}
        </Flex>
      </div>

      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4 mb-6">
        
        {/* 1. Water Level */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Water Level</Text>
          <Flex justifyContent="start" alignItems="baseline" className="space-x-2 mt-2">
            <Metric className="text-white">{latest.water_level_inches.toFixed(1)}&quot;</Metric>
            <Text className="text-slate-500">inches</Text>
          </Flex>
          <ProgressBar 
            value={(latest.water_level_inches / 15) * 100} 
            color={latest.water_level_inches > 10 ? "red" : "blue"} 
            className="mt-3" 
          />
        </Card>

        {/* 2. Battery */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Battery Voltage</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <Battery50Icon className="h-8 w-8 text-slate-500" />
            <Metric className="text-white">{latest.battery_voltage.toFixed(1)} V</Metric>
          </Flex>
        </Card>

        {/* 3. AC Power */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">Mains Power</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <BoltIcon className={`h-8 w-8 ${isPowerOn ? "text-emerald-500" : "text-rose-500"}`} />
            <Metric className={isPowerOn ? "text-white" : "text-rose-500"}>
              {isPowerOn ? "Online" : "OFFLINE"}
            </Metric>
          </Flex>
        </Card>

         {/* 4. WiFi / Signal */}
         <Card className="bg-slate-900 border-slate-800 ring-0">
          <Text className="text-slate-400">WiFi Signal</Text>
          <Flex justifyContent="start" alignItems="center" className="space-x-3 mt-2">
            <SignalIcon className="h-8 w-8 text-slate-500" />
            <Metric className="text-white">{latest.wifi_rssi || -99} dBm</Metric>
          </Flex>
        </Card>

      </Grid>

      {/* CHART SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart (Takes up 2/3rds on large screens) */}
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
              startEndOnly={true} // Cleaner x-axis labels
              autoMinValue={true}
            />
          </Card>
        </div>

        {/* Daily Stats Summary (Takes up 1/3rd) */}
        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Title className="text-white mb-4 flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-5 w-5 text-blue-500"/>
            Daily Performance
          </Title>
          <List className="mt-2">
            <ListItem className="border-slate-800">
              <span className="text-slate-400">Cycles Today</span>
              <span className="text-white font-mono font-bold">
                {daily ? daily.total_cycles : 0}
              </span>
            </ListItem>
            <ListItem className="border-slate-800">
              <span className="text-slate-400">Gallons Pumped</span>
              <span className="text-white font-mono font-bold">
                {daily ? daily.total_gallons.toFixed(1) : 0} gal
              </span>
            </ListItem>
            <ListItem className="border-slate-800">
              <span className="text-slate-400">Max Water Level</span>
              <span className="text-white font-mono font-bold">
                 {daily ? daily.max_water_level.toFixed(1) : 0}"
              </span>
            </ListItem>
          </List>
          
          <div className="mt-6 p-3 bg-slate-800/50 rounded text-xs text-slate-400 text-center">
            Stats reset at midnight
          </div>
        </Card>
      </div>

    </main>
  );
}