import type { PropsWithChildren } from "react";
import { cn } from "../utils/cn";

export function GlassPanel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl", className)}>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-xl font-semibold text-zinc-100">{value}</p>
      {sub ? <p className="text-xs text-zinc-400">{sub}</p> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  className = "",
  type = "button",
}: PropsWithChildren<{ onClick?: () => void; className?: string; type?: "button" | "submit" | "reset" }>) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-400/50 placeholder:text-zinc-500 focus:ring-2",
        props.className ?? ""
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-400/50 focus:ring-2",
        props.className ?? ""
      )}
    />
  );
}

export function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LineChart({ values, height = 120 }: { values: number[]; height?: number }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }}>
      <polyline fill="none" stroke="url(#line-gradient)" strokeWidth="2" points={points} />
      <defs>
        <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
