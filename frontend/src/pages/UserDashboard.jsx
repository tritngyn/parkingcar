import { useState, useEffect } from "react";
import {
  Bell,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Car,
  TrendingDown,
  CalendarDays,
  CircleParking,
  Home,
  Settings,
  LogOut,
  BadgeCheck,
  ScanLine,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import { socket } from "../services/socket";

function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(Math.abs(n)) + " ₫";
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </button>
  );
}

function TxRow({ tx }) {
  const isExit = tx.type === "exit";
  return (
    <div className="flex items-center gap-4 py-3.5 px-5 hover:bg-slate-50 transition-colors duration-100">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isExit ? "bg-rose-50" : "bg-emerald-50"
        }`}
      >
        {isExit
          ? <ArrowUpFromLine className="w-4 h-4 text-rose-500" strokeWidth={2} />
          : <ArrowDownToLine className="w-4 h-4 text-emerald-500" strokeWidth={2} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{tx.lane}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{tx.datetime}</p>
      </div>

      <span
        className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
          isExit
            ? "bg-rose-50 text-rose-500"
            : "bg-emerald-50 text-emerald-600"
        }`}
      >
        {isExit ? "Ra" : "Vào"}
      </span>

      <p
        className={`text-sm font-bold tabular-nums w-28 text-right shrink-0 ${
          isExit ? "text-rose-500" : "text-emerald-600"
        }`}
      >
        {isExit ? `- ${fmt(tx.fee)}` : "Miễn phí"}
      </p>
    </div>
  );
}

function HistoryTab({ transactions }) {
  const [filter, setFilter] = useState("all");

  const filteredTxs = transactions.filter(tx => {
    if (filter === "all") return true;
    const txDate = new Date(tx.timestamp);
    const now = new Date();
    
    if (filter === "today") {
      const vietnamDate = (date) => new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
      return vietnamDate(txDate) === vietnamDate(now);
    }
    if (filter === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return txDate >= oneWeekAgo;
    }
    if (filter === "month") {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    return true;
  });
  const recentTxs = filteredTxs.slice(0, 6);

  return (
    <div className="flex flex-col gap-4 shrink-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Lịch sử ra vào</h1>
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Tất cả</option>
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày qua</option>
          <option value="month">Tháng này</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[2.25rem_1fr_auto_auto] items-center gap-4 px-5 py-2.5 bg-slate-50 border-b border-border">
          <span />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Làn / Thời gian</span>
          <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Loại</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-28">Phí</span>
        </div>
        <div className="divide-y divide-border">
          {recentTxs.length > 0 ? recentTxs.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          )) : (
            <div className="p-5 text-center text-sm text-muted-foreground">Chưa có lịch sử ra vào</div>
          )}
        </div>
      </div>
    </div>
  );
}

function VehicleTab({ user, onCardAssigned }) {
  const [scanning, setScanning] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [plate, setPlate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCard = async ({ uid }) => {
      if (!scanning) return;
      setScanning(false);
      setAssigning(true);
      try {
        const response = await api.patch("/users/me/card", { cardUid: uid, plate });
        setMessage("Gán thẻ thành công");
        onCardAssigned(response.data.data);
      } catch (error) {
        setMessage(error.response?.data?.message || "Không thể gán thẻ");
      } finally {
        setAssigning(false);
      }
    };
    socket.on("assignment-card", handleCard);
    return () => {
      socket.off("assignment-card", handleCard);
    };
  }, [scanning, plate, onCardAssigned]);

  // Chỉ hủy phiên chờ khi component thực sự bị đóng. Không gửi stop trong
  // cleanup của effect phía trên vì effect đó chạy lại mỗi khi scanning đổi.
  useEffect(() => () => {
    socket.emit("assignment-scan:stop");
  }, []);

  useEffect(() => {
    if (!scanning) return undefined;
    const timer = setTimeout(() => {
      setScanning(false);
      setMessage("Hết thời gian chờ quét thẻ, vui lòng thử lại");
      socket.emit("assignment-scan:stop");
    }, 60000);
    return () => clearTimeout(timer);
  }, [scanning]);

  const startScan = () => {
    setMessage("");
    if (!socket.connected) socket.connect();
    socket.timeout(5000).emit("assignment-scan:start", (error, response) => {
      if (error || !response?.success) {
        setScanning(false);
        setMessage("Không thể bật chế độ gán thẻ. Kiểm tra kết nối backend.");
      } else {
        setScanning(true);
      }
    });
  };

  if (!user.cardUid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold text-foreground">Gán thẻ RFID</h1>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold">Tài khoản chưa được gán thẻ</p>
            <p className="text-xs text-muted-foreground mt-1">Nhập biển số, sau đó quét thẻ mới hoặc thẻ chưa được gán cho người khác.</p>
          </div>
          <input
            value={plate}
            onChange={(event) => setPlate(event.target.value.toUpperCase())}
            placeholder="Biển số xe (tùy chọn)"
            className="h-10 px-3 rounded-lg border border-border bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={startScan}
            disabled={scanning || assigning}
            className="h-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
          >
            <ScanLine className={`w-4 h-4 ${scanning ? "animate-pulse" : ""}`} />
            {assigning ? "Đang gán thẻ..." : scanning ? "Đang chờ quét thẻ..." : "Quét và gán thẻ"}
          </button>
          {message && <p className={`text-xs ${message.includes("thành công") ? "text-emerald-600" : "text-red-500"}`}>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-foreground">Phương tiện của bạn</h1>
      
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Car className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{user.plate || "Chưa cập nhật"}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                Đã xác thực
              </span>
              <span className="text-xs text-muted-foreground font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-border">
                UID: {user.cardUid || "---"}
              </span>
            </div>
            
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Chủ sở hữu</p>
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Số điện thoại</p>
                <p className="text-sm font-semibold text-foreground">{user.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelegramTab({ telegram }) {
  const [state, setState] = useState(telegram);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setState(telegram), [telegram]);

  const createLink = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post("/users/me/telegram/link");
      setLink(response.data.data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Không thể tạo liên kết Telegram");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await api.delete("/users/me/telegram/link");
      setState({ linked: false, notificationsEnabled: true, linkedAt: null });
      setLink(null);
      setMessage(response.data.message || "Đã hủy liên kết Telegram");
    } catch (error) {
      setMessage(error.response?.data?.message || "Không thể hủy liên kết Telegram");
    } finally {
      setBusy(false);
    }
  };

  const toggleNotifications = async () => {
    const enabled = !state.notificationsEnabled;
    await api.patch("/users/me/telegram/preferences", { enabled });
    setState((current) => ({ ...current, notificationsEnabled: enabled }));
  };

  return (
    <div className="flex flex-col gap-4 shrink-0">
      <h1 className="text-lg font-bold text-foreground">Thông báo Telegram</h1>
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">{state?.linked ? "Đã liên kết" : "Chưa liên kết"}</p>
            <p className="text-xs text-muted-foreground">Nhận thông báo xe vào, xe ra và yêu cầu nạp tiền.</p>
          </div>
        </div>

        {message && (
          <p className={`text-xs ${message.includes("Đã hủy") ? "text-emerald-600" : "text-red-500"}`}>
            {message}
          </p>
        )}

        {state?.linked ? (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.notificationsEnabled} onChange={toggleNotifications} />
              Bật thông báo
            </label>
            <button type="button" disabled={busy} onClick={unlink} className="text-xs font-semibold text-red-500 hover:underline">
              Hủy liên kết
            </button>
          </div>
        ) : link ? (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <p className="text-sm">Mã liên kết: <code className="font-bold text-primary">{link.code}</code></p>
            <a href={link.url} target="_blank" rel="noreferrer" className="h-10 rounded-lg bg-sky-500 text-white flex items-center justify-center text-sm font-semibold">
              Mở Telegram và liên kết
            </a>
            <p className="text-xs text-muted-foreground">Nếu Telegram không tự gửi mã, hãy gửi <code>/start {link.code}</code> cho bot. Mã có hiệu lực 10 phút.</p>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={createLink} className="h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {busy ? "Đang tạo liên kết..." : "Liên kết Telegram"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const { logout } = useAuth();
  const [activeNav, setActiveNav] = useState("Tổng quan");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpMessage, setTopUpMessage] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const NAV = [
    { label: "Tổng quan", icon: Home },
    { label: "Phương tiện", icon: Car },
    { label: "Thông báo", icon: Settings },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/users/me");
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu user", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // Tự động refresh data mỗi 10 giây nếu cần
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <p>Lỗi tải dữ liệu.</p>
        <button onClick={logout} className="px-4 py-2 bg-rose-500 text-white rounded">Đăng xuất</button>
      </div>
    );
  }

  const USER = data.user;
  const STATS = [
    {
      label: "Lượt đỗ xe",
      sub: "Tháng này",
      value: data.stats.thisMonthSessions.toString(),
      icon: CalendarDays,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      label: "Tổng chi tiêu",
      sub: "Tháng này",
      value: fmt(data.stats.thisMonthSpent),
      icon: TrendingDown,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
  ];
  const TRANSACTIONS = data.transactions;

  const handleTopUp = async (event) => {
    event.preventDefault();
    setTopUpLoading(true);
    setTopUpMessage("");
    try {
      const amount = Number(topUpAmount);
      const response = await api.patch("/users/me/top-up", { amount });
      const balance = response.data.data.balance;
      setData((current) => ({
        ...current,
        user: { ...current.user, balance },
      }));
      setTopUpMessage(`Nạp thành công ${amount.toLocaleString("vi-VN")}đ`);
      setTopUpAmount("");
    } catch (error) {
      setTopUpMessage(error.response?.data?.message || "Nạp tiền thất bại");
    } finally {
      setTopUpLoading(false);
    }
  };

  return (
    <div
      className="flex h-screen w-full bg-background overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <CircleParking className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">ParkPortal</p>
            <p className="text-[10px] text-muted-foreground">Bảng điều khiển</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            Danh mục
          </p>
          {NAV.map(({ label, icon }) => (
            <NavItem
              key={label}
              icon={icon}
              label={label}
              active={activeNav === label}
              onClick={() => setActiveNav(label)}
            />
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {USER.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{USER.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{USER.plate}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
              {USER.initials}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">
                Xin chào, {USER.name.split(" ").slice(-1)[0]} 👋
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Car className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] font-mono font-medium text-muted-foreground tracking-wide">
                  {USER.plate}
                </span>
                <BadgeCheck className="w-3 h-3 text-emerald-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {activeNav === "Tổng quan" && (
            <>
          <div>
            <h1 className="text-lg font-bold text-foreground">Bảng điều khiển</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chào mừng bạn quay lại
            </p>
          </div>

          <div className="bg-primary rounded-2xl min-h-[108px] shrink-0 px-5 sm:px-6 py-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-5 shadow-lg shadow-sky-200/60 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 -right-2 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative z-10 min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-white/70" />
                <p className="text-sm font-medium text-white/70">Số dư hiện tại</p>
              </div>
              <p className="text-[clamp(1.75rem,5vw,2.25rem)] leading-tight font-bold text-white tracking-tight mt-1 break-words">
                {new Intl.NumberFormat("vi-VN").format(USER.balance)}
                <span className="text-xl font-semibold text-white/70 ml-1">₫</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => { setShowTopUp(true); setTopUpMessage(""); }}
              className="relative z-10 flex items-center justify-center gap-2 h-10 px-5 bg-white text-primary text-sm font-semibold rounded-xl hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 shadow-md shrink-0 self-stretch sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Nạp tiền
            </button>
          </div>

          {showTopUp && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center px-4">
              <form onSubmit={handleTopUp} className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-bold">Nạp tiền mô phỏng</h2>
                  <p className="text-xs text-muted-foreground mt-1">Nhập số tiền muốn cộng vào tài khoản.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    required
                    autoFocus
                    value={topUpAmount}
                    onChange={(event) => setTopUpAmount(event.target.value)}
                    placeholder="Ví dụ: 100000"
                    className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {topUpMessage && <p className="text-xs text-primary">{topUpMessage}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowTopUp(false)} className="flex-1 h-10 rounded-lg bg-secondary text-sm font-semibold">
                    Đóng
                  </button>
                  <button type="submit" disabled={topUpLoading} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                    {topUpLoading ? "Đang nạp..." : "Xác nhận nạp"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            {STATS.map(({ label, sub, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4"
              >
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{sub}</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <HistoryTab transactions={TRANSACTIONS} />
          <div className="h-2" />
          </>
          )}
          {activeNav === "Phương tiện" && (
            <VehicleTab
              user={USER}
              onCardAssigned={({ uid, plate }) => setData((current) => ({
                ...current,
                user: { ...current.user, cardUid: uid, plate: plate || "Chưa cập nhật" },
              }))}
            />
          )}
          {activeNav === "Thông báo" && <TelegramTab telegram={USER.telegram} />}
        </main>
      </div>
    </div>
  );
}
