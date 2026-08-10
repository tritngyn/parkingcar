import { useEffect, useState } from "react";
import { useParkingRealtime } from "../hooks/useParkingRealtime";
import api from "../services/api";
import {
  Car,
  Activity,
  Zap,
  Clock,
  Wifi,
  Lock,
  Radio,
  Eye,
  EyeOff,
} from "lucide-react";

import Sidebar from "../components/Layout/Sidebar";
import Header from "../components/Layout/Header";
import StatCard from "../components/Dashboard/StatCard";
import LaneCard from "../components/Dashboard/LaneCard";
import RevenueChart from "../components/Dashboard/RevenueChart";
import CardManagement from "./CardManagement";

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Overview");
  
  // Realtime hook
  const {
    isBackendConnected,
    entryLane,
    exitLane,
    setEntryLane,
    setExitLane,
    device,
  } = useParkingRealtime();

  // State definitions
  const [activeSessions, setActiveSessions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeSessions: 0,
    todayRevenue: 0,
    avgDuration: "0h 0m"
  });

  // Settings form states (ID 5)
  const [ssid, setSsid] = useState("HCMUS_Campus");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiConnecting, setWifiConnecting] = useState(false);
  const [wifiSuccess, setWifiSuccess] = useState(false);

  const fetchOverviewData = async () => {
    try {
      const [activeRes, allRes, chartRes] = await Promise.all([
        api.get("/sessions/active"),
        api.get("/sessions"),
        api.get("/sessions/stats")
      ]);
      
      setActiveSessions(activeRes.data);
      setChartData(chartRes.data);
      
      // Tính toán các chỉ số thống kê động dựa trên dữ liệu thật
      const todayStr = new Date().toDateString();
      const todaySessions = allRes.data.filter((s) => {
        return new Date(s.time_in).toDateString() === todayStr;
      });
      
      const totalToday = todaySessions.length;
      const activeCount = activeRes.data.length;
      
      const revenueToday = todaySessions
        .filter((s) => s.status === "OUT")
        .reduce((sum, s) => sum + (s.fee || 0), 0);
      
      const exitedToday = todaySessions.filter((s) => s.status === "OUT" && s.time_out);
      let avgDurationStr = "0h 0m";
      if (exitedToday.length > 0) {
        const totalMs = exitedToday.reduce((sum, s) => {
          const duration = new Date(s.time_out).getTime() - new Date(s.time_in).getTime();
          return sum + duration;
        }, 0);
        const avgMs = totalMs / exitedToday.length;
        const avgMins = Math.round(avgMs / (60 * 1000));
        const hrs = Math.floor(avgMins / 60);
        const mins = avgMins % 60;
        avgDurationStr = `${hrs}h ${mins}m`;
      }
      
      setStats({
        totalVehicles: totalToday,
        activeSessions: activeCount,
        todayRevenue: revenueToday,
        avgDuration: avgDurationStr
      });
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu overview:", err.message);
    }
  };

  const handlePaySession = async (sessionId) => {
    try {
      await api.post("/sessions/pay", { sessionId });
      fetchOverviewData();
    } catch (err) {
      console.error("Lỗi khi thanh toán:", err.message);
    }
  };

  const handleManualOpen = async (lane) => {
    try {
      const gateLane = lane === "entry" ? "in" : "out";
      await api.post("/gate/command", {
        lane: gateLane,
        action: "open",
      });
      console.log(`Lệnh mở cổng thủ công đã gửi thành công cho làn: ${gateLane}`);
    } catch (err) {
      console.error("Lỗi khi gửi lệnh mở cổng thủ công:", err.message);
    }
  };

  const handleWifiConnect = (e) => {
    e.preventDefault();
    setWifiConnecting(true);
    setWifiSuccess(false);
    
    // Giả lập lệnh cấu hình WiFi gửi xuống ESP32
    setTimeout(() => {
      setWifiConnecting(false);
      setWifiSuccess(true);
      setWifiPassword("");
    }, 2000);
  };

  useEffect(() => {
    fetchOverviewData();
  }, [entryLane.lastScan, exitLane.lastScan]);

  return (
    <div
      className="flex h-screen w-full bg-background overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Sidebar Layout */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header Layout */}
        <Header isBackendConnected={isBackendConnected} device={device} />

        {/* Dynamic Page Rendering */}
        <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">
          {activeNav === "Overview" && (
            <>
              {/* Page Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-foreground">Overview</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time smart parking dashboard (Live data active)
                  </p>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                  label="Total Vehicles Today"
                  value={stats.totalVehicles}
                  delta="+12% vs yesterday"
                  icon={Car}
                  color="text-sky-400"
                />
                <StatCard
                  label="Active Sessions"
                  value={stats.activeSessions}
                  delta="Currently parked"
                  icon={Activity}
                  color="text-emerald-400"
                />
                <StatCard
                  label="Today's Revenue"
                  value={`₱ ${stats.todayRevenue}`}
                  delta="+₱ 920 vs yesterday"
                  icon={Zap}
                  color="text-amber-400"
                />
                <StatCard
                  label="Avg. Duration"
                  value={stats.avgDuration}
                  delta="Per vehicle session"
                  icon={Clock}
                  color="text-violet-400"
                />
              </div>

              {/* Lane Tracking Section */}
              <div className="flex items-center gap-3 mt-2">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Real-Time Lane Tracking
                </h2>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LaneCard
                  title="ENTRY LANE (IN)"
                  type="in"
                  state={entryLane}
                  onManualOpen={() => handleManualOpen("entry")}
                />
                <LaneCard
                  title="EXIT LANE (OUT)"
                  type="out"
                  state={exitLane}
                  onManualOpen={() => handleManualOpen("exit")}
                />
              </div>

              {/* Analytics Section */}
              <div className="flex items-center gap-3 mt-2">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Analytics
                </h2>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Hourly Traffic & Revenue
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Today's entries, exits, and revenue statistics aggregated from MongoDB
                    </p>
                  </div>
                </div>
                <RevenueChart data={chartData} />
              </div>

              {/* Active Sessions List */}
              <div className="bg-card border border-border rounded-xl px-6 py-5 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Active Parking Sessions
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vehicles currently in the lot or awaiting exit payment
                    </p>
                  </div>
                  <button
                    onClick={fetchOverviewData}
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
                            No active parking sessions in the lot
                          </td>
                        </tr>
                      ) : (
                        activeSessions.map((session) => (
                          <tr key={session._id} className="hover:bg-secondary/40 transition-colors">
                            <td className="py-3 font-mono font-medium tracking-wide">
                              {session.uid}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(session.time_in).toLocaleString("vi-VN")}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                session.status === "IN"
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  : "bg-amber-50 text-amber-600 border border-amber-200"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${session.status === "IN" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
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
            </>
          )}

          {activeNav === "Card Management" && <CardManagement />}

          {activeNav === "System Settings" && (
            <div className="max-w-xl mx-auto w-full bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
              <div>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Radio className="w-5 h-5 text-primary" />
                  ESP32 WiFi Configuration Setup (ID 5)
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure local WiFi credentials for the physical parking gate controller device.
                </p>
              </div>

              {wifiSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-2.5 rounded-lg">
                  🎉 WiFi settings connect request sent! Device will reboot automatically.
                </div>
              )}

              <form onSubmit={handleWifiConnect} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Available SSID Networks
                  </label>
                  <div className="flex flex-col gap-2 border border-border rounded-lg p-2.5 bg-input-background">
                    {[
                      { ssidName: "HCMUS_Campus", strength: "92%", protected: true },
                      { ssidName: "Staff_Network", strength: "78%", protected: true },
                      { ssidName: "Guest_WiFi", strength: "65%", protected: false },
                    ].map((network) => {
                      const selected = ssid === network.ssidName;
                      return (
                        <div
                          key={network.ssidName}
                          onClick={() => setSsid(network.ssidName)}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs font-medium transition-all ${
                            selected
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "hover:bg-secondary text-muted-foreground border border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Wifi className="w-3.5 h-3.5" />
                            {network.ssidName}
                          </span>
                          <span className="flex items-center gap-3 text-[10px]">
                            {network.protected && <Lock className="w-3 h-3 text-muted-foreground" />}
                            {network.strength}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="wifi-pass" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    WiFi Password
                  </label>
                  <div className="relative">
                    <input
                      id="wifi-pass"
                      type={showWifiPassword ? "text" : "password"}
                      placeholder="Enter WiFi password"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      className="w-full h-10 px-3 pr-10 rounded-lg border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWifiPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showWifiPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={wifiConnecting}
                  className="w-full h-10 mt-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-sky-400 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {wifiConnecting ? "Saving & Connecting..." : "Connect & Save Network"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
