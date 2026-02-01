import { createClient } from '@supabase/supabase-js'
import { Card, Title, Text, List, ListItem, Badge } from "@tremor/react";

export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to make timestamps readable (e.g., "Feb 1, 4:21 PM")
function formatTime(isoString: string) {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

export default async function StatsPage() {
  // Fetch latest 50 events
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false }) // Newest at top
    .limit(50);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header with Back Link */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">System Events Log</h1>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">
            &larr; Back to Dashboard
          </a>
        </div>

        <Card className="bg-slate-900 border-slate-800 ring-0">
          <Title className="text-white mb-4">Recent Pump Activity</Title>
          <div className="overflow-hidden">
            <List>
              {events?.map((event) => (
                <ListItem key={event.id} className="border-slate-800 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                    
                    {/* Event Type Badge */}
                    <div className="flex items-center gap-3">
                      <Badge 
                        color={event.event_type === 'PUMP_START' ? 'cyan' : 'indigo'} 
                        size="xs"
                      >
                        {event.event_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-white font-mono text-sm">
                        {formatTime(event.created_at)}
                      </span>
                    </div>

                    {/* Water Level Detail */}
                    <div className="text-slate-400 text-sm">
                      Level: <span className="text-white font-bold">{event.water_level_inches?.toFixed(1)}"</span>
                    </div>
                  
                  </div>
                </ListItem>
              ))}

              {(!events || events.length === 0) && (
                <div className="text-center text-slate-500 py-10">
                  No events recorded yet.
                </div>
              )}
            </List>
          </div>
        </Card>
      </div>
    </main>
  );
}
