'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-rose-500 text-6xl mb-4">!</div>
        <h2 className="text-white text-xl mb-2">Failed to load dashboard</h2>
        <p className="text-slate-400 mb-6 text-sm">
          {error.message || 'Unable to connect to sensor database. Please check your connection.'}
        </p>
        <button
          onClick={reset}
          className="bg-cyan-600 text-white px-6 py-2 rounded hover:bg-cyan-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
