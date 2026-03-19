"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="font-bold flex min-h-screen flex-col items-center justify-center gap-1">
      <h1 className="text-2xl">Something went wrong</h1>
      <p>Error Message: {error.message}</p>
      {error.digest && <p>Error ID: {error.digest}</p>}
      <a href="/">Go home</a>
    </div>
  );
}
