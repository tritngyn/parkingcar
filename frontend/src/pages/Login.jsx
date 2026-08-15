import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ParkingSquare, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { login, user } = useAuth();
  
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [signupForm, setSignupForm] = useState({ fullName: "", contact: "", password: "", plate: "" });
  const [signupMsg, setSignupMsg] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/dashboard');
      else if (user.role === 'user') navigate('/user-dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupMsg("");
    setSubmitting(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupForm)
      });
      const data = await response.json();
      if (data.success) {
        setSignupMsg("Đăng ký thành công! Hãy đăng nhập.");
        setIsLoginTab(true);
        setUsername(signupForm.contact);
        setPassword(signupForm.password);
      } else {
        setLoginError(data.message);
      }
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 bg-background text-foreground"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-3 text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
            <ParkingSquare className="w-7 h-7 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              ParkPortal
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Đăng nhập tài khoản Admin hoặc User
            </p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => { setIsLoginTab(true); setLoginError(""); }}
            className={`flex-1 text-sm py-2 rounded-md font-medium transition-colors ${isLoginTab ? "bg-white shadow text-primary" : "text-slate-500 hover:text-slate-700"}`}
          >
            Đăng nhập
          </button>
          <button
            onClick={() => { setIsLoginTab(false); setLoginError(""); }}
            className={`flex-1 text-sm py-2 rounded-md font-medium transition-colors ${!isLoginTab ? "bg-white shadow text-primary" : "text-slate-500 hover:text-slate-700"}`}
          >
            Đăng ký (User)
          </button>
        </div>

        {isLoginTab ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              {signupMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs px-3.5 py-2.5 rounded-lg">
                  ✅ {signupMsg}
                </div>
              )}
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg">
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                  Tài khoản / SĐT / Email
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="Nhập tài khoản, SĐT hoặc Email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 px-3.5 pr-11 rounded-lg border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 mt-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-sky-400 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 shadow-sm"
              >
                {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg">
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Họ và tên</label>
                <input required type="text" value={signupForm.fullName} onChange={e => setSignupForm({...signupForm, fullName: e.target.value})} className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">SĐT / Email</label>
                <input required type="text" value={signupForm.contact} onChange={e => setSignupForm({...signupForm, contact: e.target.value})} placeholder="Nhập SĐT hoặc Email" className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mật khẩu</label>
                <input required type="password" value={signupForm.password} onChange={e => setSignupForm({...signupForm, password: e.target.value})} className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Biển số xe (Tùy chọn)</label>
                <input type="text" value={signupForm.plate} onChange={e => setSignupForm({...signupForm, plate: e.target.value})} className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
              </div>



              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 mt-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 shadow-sm"
              >
                {submitting ? "Đang đăng ký..." : "Đăng ký"}
              </button>
            </div>
          </form>
        )}

        {/* ── Footer ── */}
        <div className="flex flex-col items-center gap-2 pb-2 mt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Hệ thống quản lý bãi đỗ xe an toàn
          </p>
          <span className="text-[11px] text-muted-foreground/50">ParkAdmin IoT v1.0 &copy; 2026</span>
        </div>
      </div>
    </div>
  );
}
