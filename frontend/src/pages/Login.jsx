import { useState } from "react";
import { Eye, EyeOff, ParkingSquare, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const { login } = useAuth();

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
              ParkAdmin Login
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Secure access to the parking management system
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* ── Login Form ── */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            {/* Error Message */}
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg">
                ⚠️ {loginError}
              </div>
            )}

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                placeholder="Enter your admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 pr-11 rounded-lg border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            {/* Action button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 mt-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-sky-400 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background shadow-sm"
            >
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </div>
        </form>

        {/* ── Footer ── */}
        <div className="flex flex-col items-center gap-2 pb-2 mt-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">End-to-End Encrypted</span>
          </div>
          <span className="text-[11px] text-muted-foreground/50">ParkAdmin IoT v1.0 &copy; 2026</span>
        </div>
      </div>
    </div>
  );
}
