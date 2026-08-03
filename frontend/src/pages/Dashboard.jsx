import { useEffect, useState } from "react";
import { useParkingRealtime } from "../hooks/useParkingRealtime";
import api from "../api";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Wifi,
  ParkingSquare,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Activity,
  DoorOpen,
  Clock,
  Car,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const NAV_LINKS = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Card Management", icon: CreditCard, active: false },
  { label: "System Settings", icon: Settings, active: false },
];

// Dữ liệu phân tích và biểu đồ sẽ được lấy từ Backend API thay vì Hardcode.

const STATUS_STYLES = {
  IDLE: "bg-slate-100 text-slate-500 border border-slate-200",
  SCANNING: "bg-sky-50 text-sky-600 border border-sky-200",
  OPEN: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  OPENING: "bg-amber-50 text-amber-600 border border-amber-200",
  CLOSING: "bg-amber-50 text-amber-600 border border-amber-200",
  CLOSED: "bg-slate-100 text-slate-600 border border-slate-200",
  DENIED: "bg-red-50 text-red-600 border border-red-200",
  ERROR: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_DOT = {
  IDLE: "bg-slate-400",
  SCANNING: "bg-sky-500 animate-pulse",
  OPEN: "bg-emerald-500 animate-pulse",
  OPENING: "bg-amber-500 animate-pulse",
  CLOSING: "bg-amber-500 animate-pulse",
  CLOSED: "bg-slate-500",
  DENIED: "bg-red-500",
  ERROR: "bg-red-500",
};

function LaneCard({ title, type, state, onManualOpen }) {
  const Icon = type === "in" ? ArrowDownToLine : ArrowUpFromLine;
  const iconColor = type === "in" ? "text-emerald-500" : "text-red-500";
  const iconBg = type === "in" ? "bg-emerald-50" : "bg-red-50";
  const borderAccent = type === "in" ? "border-emerald-100" : "border-red-100";

  return (
    <div className={`bg-card rounded-xl border border-border ${borderAccent} flex flex-col overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${iconColor}`} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground leading-none">
              Real-time
            </p>
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
          <span className="font-mono text-sm text-foreground tracking-wider">
            {state.uid || <span className="text-muted-foreground">—</span>}
          </span>
        </DataRow>
        <DataRow label="Status">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[state.status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[state.status]}`} />
            {state.status}
          </span>
        </DataRow>
        <DataRow label="Parking Fee">
          <span className="font-mono text-sm font-semibold text-foreground">
            {state.fee || <span className="text-muted-foreground">—</span>}
          </span>
        </DataRow>
        <DataRow label="Last Scan">
          <span className="text-sm text-muted-foreground font-mono">{state.lastScan}</span>
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

function DataRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl text-xs">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-semibold text-foreground">
              {p.dataKey === "revenue" ? `₱ ${p.value}` : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};
function convertMqttStatus(status) {
  switch (status?.toLowerCase()) {
    case "opened":
    case "open":
      return "OPEN";

    case "opening":
      return "OPENING";

    case "closing":
      return "CLOSING";

    case "closed":
      return "CLOSED";

    case "denied":
      return "DENIED";

    case "error":
      return "ERROR";

    default:
      return "IDLE";
  }
}
export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [notifications] = useState(3);

  const {
    isBackendConnected,
    entryLane,
    exitLane,
    mqttMessages,
    setEntryLane,
    setExitLane,
  } = useParkingRealtime();

  const [activeSessions, setActiveSessions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalVehicles: 0,
    activeSessionsCount: 0,
    todayRevenue: 0,
    avgDuration: "0h 0m",
  });

  const fetchActiveSessions = async () => {
    try {
      const res = await api.get("/sessions/active");
      setActiveSessions(res.data);
    } catch (err) {
      console.error("Lỗi khi tải danh sách phiên hoạt động:", err.message);
    }
  };

  const fetchAllSessionsAndAggregate = async () => {
    try {
      const res = await api.get("/sessions");
      const sessions = res.data;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalVehicles = 0;
      let activeCount = 0;
      let todayRevenue = 0;
      let totalDurationMs = 0;
      let completedCount = 0;

      const hourlyObj = {};
      for (let i = 0; i < 24; i++) {
        const hourStr = i.toString().padStart(2, '0') + ":00";
        hourlyObj[hourStr] = { hour: hourStr, entries: 0, exits: 0, revenue: 0 };
      }

      sessions.forEach(session => {
        const entryDate = new Date(session.time_in);
        const isToday = entryDate >= today;
        
        if (isToday) {
          totalVehicles++;
          const entryHour = entryDate.getHours().toString().padStart(2, '0') + ":00";
          if(hourlyObj[entryHour]) hourlyObj[entryHour].entries++;
        }

        if (session.status === "IN" || session.status === "PENDING_PAYMENT") {
          activeCount++;
        } else if (session.status === "OUT" && session.time_out) {
          const exitDate = new Date(session.time_out);
          const isExitToday = exitDate >= today;
          
          if (isExitToday) {
            todayRevenue += (session.fee || 0);
            const exitHour = exitDate.getHours().toString().padStart(2, '0') + ":00";
            if(hourlyObj[exitHour]) {
              hourlyObj[exitHour].exits++;
              hourlyObj[exitHour].revenue += (session.fee || 0);
            }
          }

          const durationMs = exitDate.getTime() - entryDate.getTime();
          if (durationMs > 0) {
            totalDurationMs += durationMs;
            completedCount++;
          }
        }
      });

      let avgDurationStr = "0h 0m";
      if (completedCount > 0) {
        const avgMs = totalDurationMs / completedCount;
        const hours = Math.floor(avgMs / (1000 * 60 * 60));
        const mins = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        avgDurationStr = `${hours}h ${mins}m`;
      }

      setAnalytics({
        totalVehicles,
        activeSessionsCount: activeCount,
        todayRevenue,
        avgDuration: avgDurationStr
      });

      // Filter hours up to current hour to make chart look better (optional, but let's just show full day)
      setChartData(Object.values(hourlyObj));

    } catch (err) {
      console.error("Lỗi khi tải tổng quan lịch sử:", err.message);
    }
  };

  const handlePaySession = async (sessionId) => {
    try {
      await api.post("/sessions/pay", { sessionId });
      fetchActiveSessions();
    } catch (err) {
      console.error("Lỗi khi thanh toán:", err.message);
    }
  };

  const handleManualOpen = async (lane, uid) => {
    try {
      const gateLane = lane === "entry" ? "in" : "out";
      await api.post("/gate/command", {
        lane: gateLane,
        action: "open",
        uid: uid || "MANUAL"
      });
      console.log(`Lệnh mở cổng thủ công đã gửi thành công cho làn: ${gateLane}`);
    } catch (err) {
      console.error("Lỗi khi gửi lệnh mở cổng thủ công:", err.message);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    fetchAllSessionsAndAggregate();
  }, [entryLane.lastScan, exitLane.lastScan]);

  return (
    <div
      className="flex h-screen w-full bg-background overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ParkingSquare className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">ParkAdmin</p>
            <p className="text-[10px] text-muted-foreground">Management System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            Navigation
          </p>
          {NAV_LINKS.map(({ label, icon: Icon }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveNav(label)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left w-full ${isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-xs font-bold shrink-0">
              AD
            </div>
            <div className="leading-tight overflow-hidden">
              <p className="text-xs font-semibold text-foreground truncate">Admin User</p>
              <p className="text-[10px] text-muted-foreground truncate">admin@parklot.sys</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search plates, UIDs, sessions..."
                className="h-8 pl-8 pr-4 w-72 rounded-lg bg-secondary border border-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-all duration-150"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell */}
            <button
              type="button"
              className="relative w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-150"
            >
              <Bell className="w-4 h-4" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border-2 border-card" />
              )}
            </button>
            {/* Avatar */}
            <button
              type="button"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-all duration-150"
            >
              <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-[10px] font-bold">
                AD
              </div>
              <span className="text-xs font-medium text-foreground">Admin</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Page title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">Overview</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monday, July 14, 2026 — Real-time monitoring active
              </p>
            </div>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isBackendConnected
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isBackendConnected
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-red-500"
                  }`}
              />

              <span
                className={`text-[11px] font-semibold ${isBackendConnected
                  ? "text-emerald-600"
                  : "text-red-600"
                  }`}
              >
                {isBackendConnected
                  ? "Backend Connected"
                  : "Backend Disconnected"}
              </span>
            </div>
          </div>
          {/* Stat cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Car className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground leading-none">Total Vehicles Today</p>
                <p className="text-xl font-bold text-foreground mt-1 leading-none">{analytics.totalVehicles}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Vehicles entered today</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground leading-none">Active Sessions</p>
                <p className="text-xl font-bold text-foreground mt-1 leading-none">{analytics.activeSessionsCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Currently parked</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground leading-none">Today's Revenue</p>
                <p className="text-xl font-bold text-foreground mt-1 leading-none">₱ {analytics.todayRevenue}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Earnings today</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground leading-none">Avg. Duration</p>
                <p className="text-xl font-bold text-foreground mt-1 leading-none">{analytics.avgDuration}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Per completed session</p>
              </div>
            </div>
          </div>

          {/* Section label */}
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
              Real-Time Lane Tracking
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Lane cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LaneCard
              title="ENTRY LANE (IN)"
              type="in"
              state={entryLane}
              onManualOpen={() => handleManualOpen("entry", entryLane?.uid)}
            />
            <LaneCard
              title="EXIT LANE (OUT)"
              type="out"
              state={exitLane}
              onManualOpen={() => handleManualOpen("exit", exitLane?.uid)}
            />
          </div>

          {/* Analytics section label */}
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
              Analytics
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Bar chart card */}
          <div className="bg-card border border-border rounded-xl px-6 py-5 pb-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Hourly Traffic & Revenue Statistics</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Today's vehicle entries, exits, and revenue by hour</p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> Entries
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500/80 inline-block" /> Exits
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Revenue (₱)
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={2} barCategoryGap="28%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="entries" name="Entries" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="exits" name="Exits" fill="rgba(239,68,68,0.75)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active Sessions & MQTT Logs */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-2">
            {/* Active Sessions Table */}
            <div className="xl:col-span-2 bg-card border border-border rounded-xl px-6 py-5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Active Parking Sessions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Vehicles currently parked or pending payment</p>
                </div>
                <button
                  onClick={fetchActiveSessions}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                      <th className="py-2.5 pb-2">Card UID</th>
                      <th className="py-2.5 pb-2">Time In</th>
                      <th className="py-2.5 pb-2">Status</th>
                      <th className="py-2.5 pb-2">Current Fee</th>
                      <th className="py-2.5 pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No active parking sessions
                        </td>
                      </tr>
                    ) : (
                      activeSessions.map((session) => (
                        <tr key={session._id} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 font-mono font-medium tracking-wide">{session.uid}</td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(session.time_in).toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${session.status === "IN"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-amber-50 text-amber-600 border border-amber-200"
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${session.status === "IN" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                                }`} />
                              {session.status}
                            </span>
                          </td>
                          <td className="py-3 font-semibold font-mono">
                            {session.fee > 0 ? `₱ ${session.fee.toFixed(2)}` : "₱ 0.00"}
                          </td>
                          <td className="py-3 text-right">
                            {session.status === "PENDING_PAYMENT" ? (
                              <button
                                onClick={() => handlePaySession(session._id)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold rounded active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-amber-500/10"
                              >
                                Pay & Open Exit
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="h-2" />
        </main>
      </div>
    </div>
  );
}
