"use client";

import Link from "next/link";

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
      <button onClick={() => reset()} className="mt-2 text-sm underline">Try Again</button>
      <Link href="/">Go home</Link>
    </div>
  );
}
