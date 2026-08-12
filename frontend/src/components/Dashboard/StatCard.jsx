import React from "react";

export default function StatCard({ label, value, delta, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-bold text-foreground tracking-tight">
          {value}
        </span>
        <span className="text-[11px] text-muted-foreground leading-none">
          {delta}
        </span>
      </div>
      <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${color || "text-primary"}`}>
        <Icon className="w-6 h-6" strokeWidth={1.5} />
      </div>
    </div>
  );
}
