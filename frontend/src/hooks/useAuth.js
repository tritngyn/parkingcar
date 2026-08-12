import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Đọc thông tin đăng nhập lưu ở localStorage khi khởi chạy app
    const storedToken = localStorage.getItem("admin_token");
    const storedUser = localStorage.getItem("admin_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data.success) {
        const { token: receivedToken, user: receivedUser } = response.data;
        
        localStorage.setItem("admin_token", receivedToken);
        localStorage.setItem("admin_user", JSON.stringify(receivedUser));
        
        setToken(receivedToken);
        setUser(receivedUser);
        
        navigate("/dashboard");
        return true;
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setUser(null);
    navigate("/");
  };

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    login,
    logout,
  };
}
