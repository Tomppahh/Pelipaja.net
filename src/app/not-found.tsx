import Link from "next/link";

export default function NotFound() {
  return (
    <div className="font-bold flex min-h-screen flex-col items-center justify-center gap-1">
      <h1 className="text-9xl">404</h1>
      <p className="text-xl">Page not found</p>
      <Link className="pt-10" href="/">Go home</Link>
    </div>
  );
}