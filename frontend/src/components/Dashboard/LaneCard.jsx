import { ArrowDownToLine, ArrowUpFromLine, Wifi, DoorOpen } from "lucide-react";

const STATUS_STYLES = {
  IDLE: "bg-slate-100 text-slate-500 border border-slate-200",
  SCANNING: "bg-sky-50 text-sky-600 border border-sky-200",
  OPEN: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  OPENING: "bg-amber-50 text-amber-600 border border-amber-200",
  CLOSING: "bg-amber-50 text-amber-600 border border-amber-200",
  CLOSE: "bg-slate-100 text-slate-600 border border-slate-200",
  DENIED: "bg-red-50 text-red-600 border border-red-200",
  ERROR: "bg-red-50 text-red-600 border border-red-200",
  PENDING_PAYMENT: "bg-amber-50 text-amber-600 border border-amber-200", // Thêm trạng thái chờ thanh toán
};

const STATUS_DOT = {
  IDLE: "bg-slate-400",
  SCANNING: "bg-sky-500 animate-pulse",
  OPEN: "bg-emerald-500 animate-pulse",
  OPENING: "bg-amber-500 animate-pulse",
  CLOSING: "bg-amber-500 animate-pulse",
  CLOSE: "bg-slate-500",
  DENIED: "bg-red-500",
  ERROR: "bg-red-500",
  PENDING_PAYMENT: "bg-amber-500 animate-pulse",
};

function DataRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function LaneCard({ title, type, state, onManualOpen }) {
  const Icon = type === "in" ? ArrowDownToLine : ArrowUpFromLine;
  const iconColor = type === "in" ? "text-emerald-500" : "text-red-500";
  const iconBg = type === "in" ? "bg-emerald-50" : "bg-red-50";
  const borderAccent = type === "in" ? "border-emerald-100" : "border-red-100";

  return (
    <div className={`bg-card rounded-xl border border-border ${borderAccent} flex flex-col overflow-hidden shadow-sm`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${iconColor}`} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mt-0.5">{title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[10px] font-medium text-sky-400 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Data rows */}
      <div className="flex flex-col gap-0 divide-y divide-border px-5 py-1">
        <DataRow label="Scanned RFID UID">
          <span className="font-mono text-sm text-foreground tracking-wider font-semibold">
            {state.uid || <span className="text-muted-foreground">—</span>}
          </span>
        </DataRow>
        <DataRow label="Status">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[state.status] || STATUS_STYLES.IDLE}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[state.status] || STATUS_DOT.IDLE}`} />
            {state.status}
          </span>
        </DataRow>
        <DataRow label="Parking Fee">
          <span className="font-mono text-sm font-semibold text-foreground">
            {state.fee ? state.fee : <span className="text-muted-foreground">—</span>}
          </span>
        </DataRow>
      </div>

      {/* Action button */}
      <div className="px-5 pb-5 pt-4 mt-auto">
        <button
          type="button"
          onClick={onManualOpen}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-sky-400 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-sky-500/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
        >
          <DoorOpen className="w-4 h-4" />
          Manual Open Gate
        </button>
      </div>
    </div>
  );
}
