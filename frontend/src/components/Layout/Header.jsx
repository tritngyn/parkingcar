export default function Header({ isBackendConnected, device }) {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-card px-8 flex items-center justify-end">
      {/* Right controls */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border"
          title={`Thiết bị: ${device?.status || "offline"}`}
        >
          <span className={`w-2 h-2 rounded-full ${device?.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            Thiết bị {device?.status === "online" ? "Online" : "Offline"}
          </span>
        </div>
        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border">
          <span className={`w-2 h-2 rounded-full ${isBackendConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            {isBackendConnected ? "Đã kết nối" : "Mất kết nối"}
          </span>
        </div>
      </div>
    </header>
  );
}
