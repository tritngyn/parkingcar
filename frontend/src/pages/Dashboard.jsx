import { useEffect, useState, useMemo } from "react";
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
  const [chartFilter, setChartFilter] = useState("today");
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
      const [activeRes, allRes] = await Promise.all([
        api.get("/sessions/active"),
        api.get("/sessions"),
      ]);

      setActiveSessions(activeRes.data);
      setAllSessions(allRes.data);

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

  // States for filtering history
  const [historyFilter, setHistoryFilter] = useState("all");

  // Filtering logic for allSessions
  const filteredSessions = allSessions.filter((s) => {
    if (historyFilter === "all") return true;
    
    if (!s.time_in) return false;
    const match = s.time_in.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (!match) return false;
    const [, month, day, year] = match;
    const sessionDate = new Date(+year, +month - 1, +day);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (historyFilter === "today") {
      return sessionDate.getTime() === today.getTime();
    }
    
    if (historyFilter === "week") {
      // get start of week (monday)
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(today.setDate(diff));
      return sessionDate >= startOfWeek;
    }
    
    if (historyFilter === "month") {
      return sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear();
    }
    
    return true;
  }).sort((a, b) => {
    const parseTime = (str) => {
      if (!str) return 0;
      const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
      if (!match) return 0;
      return new Date(+match[3], +match[1] - 1, +match[2], +match[4], +match[5]).getTime();
    };
    return parseTime(b.time_in) - parseTime(a.time_in);
  });

  const computedChartData = useMemo(() => {
    const parseTime = (str) => {
      if (!str) return null;
      const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
      if (!match) return null;
      return new Date(+match[3], +match[1] - 1, +match[2], +match[4], +match[5]);
    };

    const now = new Date();
    
    if (chartFilter === "today") {
      const data = [];
      for (let h = 0; h <= 23; h++) {
         data.push({ label: `${String(h).padStart(2, "0")}:00`, entries: 0, exits: 0, revenue: 0 });
      }
      
      allSessions.forEach(s => {
        const dIn = parseTime(s.time_in);
        if (dIn && dIn.toDateString() === now.toDateString()) {
           const hIn = dIn.getHours();
           data[hIn].entries++;
        }
        
        const dOut = parseTime(s.time_out);
        if (dOut && dOut.toDateString() === now.toDateString()) {
           const hOut = dOut.getHours();
           data[hOut].exits++;
           data[hOut].revenue += Number(s.fee) || 0;
        }
      });
      return data;
    }
    
    if (chartFilter === "week") {
      const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
      const data = dayNames.map(name => ({ label: name, entries: 0, exits: 0, revenue: 0 }));
      
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0,0,0,0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      
      allSessions.forEach(s => {
         const dIn = parseTime(s.time_in);
         if (dIn && dIn >= startOfWeek && dIn < endOfWeek) {
            const idx = dIn.getDay() === 0 ? 6 : dIn.getDay() - 1;
            data[idx].entries++;
         }
         const dOut = parseTime(s.time_out);
         if (dOut && dOut >= startOfWeek && dOut < endOfWeek) {
            const idx = dOut.getDay() === 0 ? 6 : dOut.getDay() - 1;
            data[idx].exits++;
            data[idx].revenue += (s.fee || 0);
         }
      });
      return data;
    }
    
    if (chartFilter === "month") {
      const maxDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const data = [];
      for (let i = 1; i <= maxDays; i++) {
         data.push({ label: `${i}`, entries: 0, exits: 0, revenue: 0 });
      }
      
      allSessions.forEach(s => {
         const dIn = parseTime(s.time_in);
         if (dIn && dIn.getMonth() === now.getMonth() && dIn.getFullYear() === now.getFullYear()) {
            const idx = dIn.getDate() - 1;
            data[idx].entries++;
         }
         const dOut = parseTime(s.time_out);
         if (dOut && dOut.getMonth() === now.getMonth() && dOut.getFullYear() === now.getFullYear()) {
            const idx = dOut.getDate() - 1;
            data[idx].exits++;
            data[idx].revenue += (s.fee || 0);
         }
      });
      return data;
    }
    
    return [];
  }, [allSessions, chartFilter]);

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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <p className="font-semibold">Quy định giá đỗ xe:</p>
                  <p>Giá đỗ xe: 20.000 VNĐ / giờ</p>
                  <p>Công thức: Tổng phí = (Số giờ đỗ, làm tròn lên) × 20.000 VNĐ</p>
                </div>
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
                  value={`${Number(stats.todayRevenue).toLocaleString("vi-VN")} VNĐ`}
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
                      Thống kê trực tiếp từ dữ liệu lịch sử
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={chartFilter}
                      onChange={(e) => setChartFilter(e.target.value)}
                      className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs"
                    >
                      <option value="today">Hôm nay (Theo giờ)</option>
                      <option value="week">Tuần này (Theo thứ)</option>
                      <option value="month">Tháng này (Theo ngày)</option>
                    </select>
                  </div>
                </div>
                <RevenueChart data={computedChartData} />
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
                              {session.fee > 0 ? `${Number(session.fee).toLocaleString("vi-VN")} VNĐ` : "0 VNĐ"}
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
                      Đã ghi nhận {filteredSessions.length} lượt vào/ra
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                      className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs"
                    >
                      <option value="all">Tất cả</option>
                      <option value="today">Hôm nay</option>
                      <option value="week">Tuần này</option>
                      <option value="month">Tháng này</option>
                    </select>
                    <button
                      onClick={fetchOverviewData}
                      className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Làm mới
                    </button>
                  </div>
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
                      {filteredSessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Chưa có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        filteredSessions.map((s) => (
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
                              {s.fee > 0 ? `${Number(s.fee).toLocaleString("vi-VN")} VNĐ` : "—"}
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
