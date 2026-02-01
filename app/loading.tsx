export default function Loading() {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Loading sensor data...</p>
      </div>
    </div>
  );
}
