import { LayoutDashboard, CreditCard, Settings, ParkingSquare, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const NAV_LINKS = [
  { label: "Tổng quan", icon: LayoutDashboard },
  { label: "Quản lý thẻ", icon: CreditCard },
];

export default function Sidebar({ activeNav, setActiveNav }) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <ParkingSquare className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">ParkAdmin</p>
          <p className="text-[10px] text-muted-foreground">Hệ thống quản lý</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
          Điều hướng
        </p>
        {NAV_LINKS.map(({ label, icon: Icon }) => {
          const isActive = activeNav === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveNav(label)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left w-full ${
                isActive
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

      {/* Sidebar footer / User profile */}
      <div className="px-4 py-4 border-t border-border flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-xs font-bold shrink-0">
            AD
          </div>
          <div className="leading-tight overflow-hidden">
            <p className="text-xs font-bold text-foreground truncate">
              {user?.username || "Admin User"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user?.username ? `${user.username}@parklot.sys` : "admin@parklot.sys"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all duration-150"
        >
          <LogOut className="w-3.5 h-3.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
