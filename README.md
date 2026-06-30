# Smart Parking Management System

Hệ thống Quản lý Bãi đỗ xe Thông minh sử dụng MERN Stack, Tailwind CSS, và giao thức MQTT.

## Yêu cầu môi trường (Prerequisites)
- **Node.js**: Phiên bản 18+ (khuyên dùng).
- **MongoDB**: Chạy MongoDB local (cổng mặc định `27017`) hoặc cung cấp chuỗi kết nối MongoDB Atlas trong file `.env`.
- **Git**: Khuyên dùng để quản lý mã nguồn.

---

## Hướng dẫn khởi động (Development Mode)

Project bao gồm 2 phần độc lập: **Backend** (Node.js/Express) và **Frontend** (React/Vite). Bạn cần mở 2 terminal (cửa sổ dòng lệnh) riêng biệt để chạy song song cả hai.

### 1. Khởi động Backend (API & MQTT Client)

Mở terminal 1 và thực hiện các lệnh sau:

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt các gói thư viện phụ thuộc (nếu chưa cài)
npm install

# Khởi động server ở chế độ phát triển (sử dụng nodemon tự động reload)
npm run dev
```

> **Lưu ý:**
> Backend cần kết nối tới cơ sở dữ liệu MongoDB. Mặc định nó sẽ thử kết nối tới `mongodb://127.0.0.1:27017/smart_parking`. Bạn có thể chỉnh sửa cấu hình trong file `backend/.env` nếu cấu hình máy của bạn khác.
> Server backend sẽ chạy ở địa chỉ `http://localhost:5000`.

---

### 2. Khởi động Frontend (React UI)

Mở terminal 2 và thực hiện các lệnh sau:

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt các gói thư viện phụ thuộc (nếu chưa cài)
npm install

# Khởi động React Vite server
npm run dev
```

> **Lưu ý:**
> Vite thường sẽ chạy Frontend tại `http://localhost:5173`. Bạn chỉ cần nhấn vào đường link hiển thị trong terminal hoặc copy/paste vào trình duyệt để xem giao diện web.

---

## Các cấu hình Môi trường (.env)

Hệ thống sử dụng file môi trường tại `backend/.env`. Bạn có thể tham khảo hoặc thay đổi các thông số sau để phù hợp với môi trường của bạn:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart_parking
JWT_SECRET=supersecretjwtkey_change_in_production
MQTT_BROKER=mqtt://test.mosquitto.org
```

- `MQTT_BROKER`: Broker MQTT public đang được dùng để mô phỏng ESP32 quét thẻ RFID. Để test ứng dụng, bạn có thể dùng **MQTT Explorer** kết nối tới broker `test.mosquitto.org` và gửi message vào topic `parking/gate/scan`.
