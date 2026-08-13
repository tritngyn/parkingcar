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
  ChevronRight,
  CircleParking,
  History,
  Home,
  Settings,
  LogOut,
  BadgeCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";

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
        {isExit ? "Exit" : "Entry"}
      </span>

      <p
        className={`text-sm font-bold tabular-nums w-28 text-right shrink-0 ${
          isExit ? "text-rose-500" : "text-emerald-600"
        }`}
      >
        {isExit ? `- ${fmt(tx.fee)}` : "Free"}
      </p>
    </div>
  );
}

function HistoryTab({ transactions }) {
  const [filter, setFilter] = useState("all");

  const filteredTxs = transactions.filter(tx => {
    if (filter === "all") return true;
    const txDateStr = tx.datetime; 
    const [datePart] = txDateStr.split(", ");
    const [dd, mm, yyyy] = datePart.split("/");
    const txDate = new Date(`${yyyy}-${mm}-${dd}`);
    const now = new Date();
    
    if (filter === "today") {
      return txDate.toDateString() === now.toDateString();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Lịch sử giao dịch</h1>
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
          {filteredTxs.length > 0 ? filteredTxs.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          )) : (
            <div className="p-5 text-center text-sm text-muted-foreground">Không có giao dịch nào</div>
          )}
        </div>
      </div>
    </div>
  );
}

function VehicleTab({ user }) {
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

export default function UserDashboard() {
  const { logout } = useAuth();
  const [activeNav, setActiveNav] = useState("Tổng quan");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const NAV = [
    { label: "Tổng quan", icon: Home },
    { label: "Phương tiện", icon: Car },
    { label: "Lịch sử",    icon: History },
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

          <div className="bg-primary rounded-2xl px-6 py-6 flex items-center justify-between shadow-lg shadow-sky-200/60 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 -right-2 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-white/70" />
                <p className="text-sm font-medium text-white/70">Số dư hiện tại</p>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight mt-1">
                {new Intl.NumberFormat("vi-VN").format(USER.balance)}
                <span className="text-xl font-semibold text-white/70 ml-1">₫</span>
              </p>
            </div>

            <button
              type="button"
              className="relative z-10 flex items-center gap-2 h-10 px-5 bg-white text-primary text-sm font-semibold rounded-xl hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 shadow-md shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nạp tiền
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Hoạt động gần đây</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav("Lịch sử")}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors"
              >
                Xem tất cả
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-[2.25rem_1fr_auto_auto] items-center gap-4 px-5 py-2.5 bg-slate-50 border-b border-border">
              <span />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Làn / Thời gian
              </span>
              <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Loại
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right w-28">
                Phí
              </span>
            </div>

            <div className="divide-y divide-border">
              {TRANSACTIONS.length > 0 ? TRANSACTIONS.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              )) : (
                <div className="p-5 text-center text-sm text-muted-foreground">Không có giao dịch nào</div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-border text-center">
              <p className="text-[11px] text-muted-foreground">
                Đang hiển thị {TRANSACTIONS.length} giao dịch gần nhất
              </p>
            </div>
          </div>
          <div className="h-2" />
          </>
          )}
          {activeNav === "Phương tiện" && <VehicleTab user={USER} />}
          {activeNav === "Lịch sử" && <HistoryTab transactions={TRANSACTIONS} />}
        </main>
      </div>
    </div>
  );
}
