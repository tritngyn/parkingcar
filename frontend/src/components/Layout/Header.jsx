import { Search, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function Header({ isBackendConnected, device }) {
  const { user } = useAuth();

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card px-8 flex items-center justify-between">
      {/* Search Input */}
      <div className="flex items-center gap-3 w-80">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search plates, UIDs, sessions..."
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-input-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent transition-all duration-150"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border"
          title={`WiFi: ${device?.ssid || "—"} | IP: ${device?.ip || "—"} | RSSI: ${device?.rssi ?? "—"} dBm`}
        >
          <span className={`w-2 h-2 rounded-full ${device?.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            ESP {device?.status === "online" ? "Online" : "Offline"}
            {device?.ssid ? ` · ${device.ssid}` : ""}
          </span>
        </div>
        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border">
          <span className={`w-2 h-2 rounded-full ${isBackendConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            {isBackendConnected ? "Connected" : "Offline"}
          </span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="w-9 h-9 rounded-lg border border-border hover:bg-secondary flex items-center justify-center relative text-muted-foreground hover:text-foreground transition-all duration-150"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
        </button>

        {/* User profile dropdown button */}
        <button
          type="button"
          className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-all duration-150"
        >
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
            AD
          </div>
          <span className="text-xs font-semibold text-foreground">{user?.username || "Admin"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
