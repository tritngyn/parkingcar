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
  const [activeNav, setActiveNav] = useState("Tổng quan");

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
  const [allSessions, setAllSessions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [paymentError, setPaymentError] = useState("");
  const [payingSessionId, setPayingSessionId] = useState(null);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeSessions: 0,
    todayRevenue: 0,
    avgDuration: "0h 0m",
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
        api.get("/sessions/stats"),
      ]);

      setActiveSessions(activeRes.data);
      setAllSessions(allRes.data);           // ← Lưu toàn bộ lịch sử
      setChartData(chartRes.data);

      // Lọc xe hôm nay: so sánh phần ngày MM/DD/YYYY trong chuỗi đã format
      const todayParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }).formatToParts(new Date());
      const todayValues = Object.fromEntries(
        todayParts.map(({ type, value }) => [type, value]),
      );
      const todayFormatted = `${todayValues.month}/${todayValues.day}/${todayValues.year}`;

      const todaySessions = allRes.data.filter((s) =>
        s.time_in && s.time_in.startsWith(todayFormatted)
      );

      const totalToday = todaySessions.length;
      const activeCount = activeRes.data.length;

      const revenueToday = todaySessions
        .filter((s) => s.status === "OUT")
        .reduce((sum, s) => sum + (s.fee || 0), 0);

      // Tính thời gian đỗ trung bình từ chuỗi đã format "MM/DD/YYYY HH:mm"
      const parseFormatted = (str) => {
        if (!str) return null;
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
        if (!match) return null;
        const [, month, day, year, hour, minute] = match;
        return Date.UTC(+year, +month - 1, +day, +hour, +minute);
      };
      const exitedToday = todaySessions.filter((s) => s.status === "OUT" && s.time_out);
      let avgDurationStr = "0h 0m";
      if (exitedToday.length > 0) {
        const totalMs = exitedToday.reduce((sum, s) => {
          const duration = parseFormatted(s.time_out) - parseFormatted(s.time_in);
          return sum + (duration > 0 ? duration : 0);
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
        avgDuration: avgDurationStr,
      });
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu overview:", err.message);
    }
  };

  const handlePaySession = async (sessionId) => {
    setPaymentError("");
    setPayingSessionId(sessionId);
    try {
      await api.post("/sessions/pay", { sessionId });
      await fetchOverviewData();
    } catch (err) {
      console.error("Lỗi khi thanh toán:", err.message);
      const data = err.response?.data;
      const detail = data?.balance !== undefined
        ? ` (Số dư: ${Number(data.balance).toLocaleString("vi-VN")}đ, cần: ${Number(data.required).toLocaleString("vi-VN")}đ)`
        : "";
      setPaymentError(`${data?.message || "Thanh toán thất bại"}${detail}`);
    } finally {
      setPayingSessionId(null);
    }
  };

  const handleManualOpen = async (lane, uid) => {
    try {
      const gateLane = lane === "entry" ? "in" : "out";
      await api.post("/gate/command", {
        lane: gateLane,
        action: "open",
        uid: uid || null,
      });
      console.log(
        `Lệnh mở cổng thủ công đã gửi thành công cho làn: ${gateLane}`,
      );
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
          {activeNav === "Tổng quan" && (
            <>
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Tổng quan Hệ thống
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Quản lý và giám sát bãi đỗ xe theo thời gian thực
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={Car}
                  label="Tổng số xe hôm nay"
                  value={stats.totalVehicles}
                  color="text-primary"
                />
                <StatCard
                  icon={Activity}
                  label="Xe đang trong bãi"
                  value={stats.activeSessions}
                  color="text-emerald-500"
                />
                <StatCard
                  icon={Zap}
                  label="Doanh thu hôm nay"
                  value={new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(stats.todayRevenue)}
                  color="text-amber-500"
                />
                <StatCard
                  icon={Clock}
                  label="Thời gian đỗ TB"
                  value={stats.avgDuration}
                  color="text-purple-500"
                />
              </div>

              {/* Lane Tracking Section */}
              <div className="flex items-center gap-3 mt-2">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Giám sát làn xe
                </h2>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LaneCard
                  title="Lối vào"
                  type="in"
                  state={entryLane}
                  onManualOpen={() => handleManualOpen("entry", entryLane.uid)}
                />
                <LaneCard
                  title="Lối ra"
                  type="out"
                  state={exitLane}
                  onManualOpen={() => handleManualOpen("exit", exitLane.uid)}
                />
              </div>

              {/* Analytics Section */}
              <div className="flex items-center gap-3 mt-2">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Phân tích
                </h2>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Lưu lượng & Doanh thu
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Thống kê theo giờ từ cơ sở dữ liệu
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
                      Phiên đỗ xe hiện tại
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Danh sách các phương tiện đang trong bãi
                    </p>
                  </div>
                  <button
                    onClick={fetchOverviewData}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Làm mới
                  </button>
                </div>

                {paymentError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {paymentError}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                        <th className="py-2.5 pb-2">UID Thẻ</th>
                        <th className="py-2.5 pb-2">Thời gian vào</th>
                        <th className="py-2.5 pb-2">Trạng thái</th>
                        <th className="py-2.5 pb-2">Phí hiện tại</th>
                        <th className="py-2.5 pb-2 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {activeSessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Không có phiên đỗ xe nào
                          </td>
                        </tr>
                      ) : (
                        activeSessions.map((session) => (
                          <tr
                            key={session._id}
                            className="hover:bg-secondary/40 transition-colors"
                          >
                            <td className="py-3 font-mono font-medium tracking-wide">
                              {session.uid}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {session.time_in || "—"}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  session.status === "IN"
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                    : "bg-amber-50 text-amber-600 border border-amber-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${session.status === "IN" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
                                />
                                {session.status === "IN" ? "Trong bãi" : "Chờ thanh toán"}
                              </span>
                            </td>
                            <td className="py-3 font-semibold font-mono">
                              {session.fee > 0
                                ? new Intl.NumberFormat("vi-VN", {
                                    style: "currency",
                                    currency: "VND",
                                  }).format(session.fee)
                                : "0 ₫"}
                            </td>
                            <td className="py-3 text-right">
                              {session.status === "PENDING_PAYMENT" ? (
                                <button
                                  onClick={() => handlePaySession(session._id)}
                                  disabled={payingSessionId === session._id}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold rounded active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-amber-500/10"
                                >
                                  {payingSessionId === session._id ? "Đang xử lý..." : "Thanh toán"}
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* History Sessions Table */}
              <div className="bg-card border border-border rounded-xl px-6 py-5 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Lịch sử phiên đỗ xe</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tất cả {allSessions.length} lượt vào/ra đã ghi nhận
                    </p>
                  </div>
                  <button
                    onClick={fetchOverviewData}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                        <th className="py-2.5 pb-2">UID Thẻ</th>
                        <th className="py-2.5 pb-2">Thời gian vào</th>
                        <th className="py-2.5 pb-2">Thời gian ra</th>
                        <th className="py-2.5 pb-2">Trạng thái</th>
                        <th className="py-2.5 pb-2 text-right">Phí</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {allSessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Chưa có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        allSessions.map((s) => (
                          <tr key={s._id} className="hover:bg-secondary/40 transition-colors">
                            <td className="py-2.5 font-mono font-medium tracking-wide">{s.uid}</td>
                            <td className="py-2.5 text-muted-foreground">{s.time_in || "—"}</td>
                            <td className="py-2.5 text-muted-foreground">{s.time_out || "—"}</td>
                            <td className="py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === "OUT"
                                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                                  : s.status === "PENDING_PAYMENT"
                                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  s.status === "OUT" ? "bg-slate-400" :
                                  s.status === "PENDING_PAYMENT" ? "bg-amber-500 animate-pulse" :
                                  "bg-emerald-500"
                                }`} />
                                {s.status === "OUT" ? "Đã ra" : s.status === "PENDING_PAYMENT" ? "Chờ TT" : "Trong bãi"}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-semibold font-mono">
                              {s.fee > 0 ? `₱ ${s.fee}` : "—"}
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

          {activeNav === "Quản lý thẻ" && <CardManagement />}
        </main>
      </div>
    </div>
  );
}
