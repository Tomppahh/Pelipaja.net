"use client";

import Link from "next/link";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="font-bold flex min-h-screen flex-col items-center justify-center gap-1">
      <h1 className="text-2xl">Something went wrong</h1>
      <p>Error Message: {error.message}</p>
      {error.digest && <p>Error ID: {error.digest}</p>}
      <Link href="/">Go home</Link>
    </div>
  );
}
