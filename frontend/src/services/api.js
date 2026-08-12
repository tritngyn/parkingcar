import axios from "axios";

// Tạo instance Axios với cấu hình mặc định
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 10000,
});

// Request interceptor tự động đính kèm Token JWT vào header (ID 7)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor để xử lý lỗi token hết hạn (401/403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Xóa token lỗi/hết hạn và redirect về login nếu cần
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      // Có thể kích hoạt redirect thủ công ở đây nếu không sử dụng router state
    }
    return Promise.reject(error);
  }
);

export default api;
