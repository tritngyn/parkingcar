# Smart Parking Management System - Implementation Plan & Tasks

## Phase 1: Project Setup and Architecture
- [x] Initialize project directories (`backend` and `frontend`).
- [x] Backend: Initialize Node.js, install dependencies (`express`, `mongoose`, `mqtt`, `jsonwebtoken`, `bcrypt`, `cors`, `dotenv`).
- [x] Frontend: Initialize React app using Vite (`npm create vite@latest frontend -- --template react`), install dependencies (`tailwindcss`, `recharts`, `axios`, `react-router-dom`).
- [x] Configure Tailwind CSS in the frontend.

## Phase 2: Database Schema (MongoDB/Mongoose)
- [x] Connect Express to MongoDB.
- [x] Create `Admin` Schema: `username`, `password` (hashed).
- [x] Create `Card` Schema: `uid` (String, unique), `type` (Enum: 'VIP', 'GUEST').
- [x] Create `ParkingSession` Schema: `uid` (String), `time_in` (Date), `time_out` (Date), `fee` (Number), `status` (Enum: 'IN', 'OUT', 'PENDING_PAYMENT').

## Phase 3: Backend API & Authentication
- [ ] Implement Admin Signup API (`POST /api/auth/signup`).
- [ ] Implement Admin Login API (`POST /api/auth/login`) with JWT generation.
- [ ] Create JWT middleware to protect dashboard and checkout routes.
- [ ] Create CRUD endpoints for `Cards` (Add, list, delete).
- [ ] Create API for fetching `ParkingSessions` (active, history).

## Phase 4: MQTT Integration (Backend)
- [ ] Set up MQTT.js client to connect to a public broker (e.g., `test.mosquitto.org`).
- [ ] Subscribe to topic: `parking/gate/scan`.
- [ ] Implement Scan Logic:
  - When UID is received, check if there is an active session (`status: 'IN'`).
  - If NO active session: Create new session (`status: 'IN'`), publish to `parking/gate/control` (message: 'OPEN_IN').
  - If ACTIVE session: Update session `status` to 'PENDING_PAYMENT' (or 'OUT' if VIP), calculate fee if guest. Publish 'OPEN_OUT' if fully paid or VIP.
- [ ] Implement Manual Gate Control API (`POST /api/gate/open`) that publishes to `parking/gate/control`.

## Phase 5: Frontend Development (React + Tailwind)
- [ ] Setup Routing (`react-router-dom`): `/login`, `/dashboard`, `/checkout`.
- [ ] Create visually stunning, modern UI theme (dark mode, glassmorphism).
- [ ] Implement Auth UI: Login Screen.
- [ ] Implement Dashboard Layout: Sidebar, Navbar.
- [ ] Dashboard - Analytics: Add Recharts for vehicle flow by hour and revenue.
- [ ] Dashboard - Active Sessions: Table showing vehicles currently 'IN'.
- [ ] Dashboard - Manual Control: Button to manually open gates.

## Phase 6: Checkout Flow (Frontend)
- [ ] Create Checkout UI component to list 'PENDING_PAYMENT' sessions.
- [ ] Implement mock QR payment flow.
- [ ] API integration: Call backend to update session `status` to 'OUT' and publish MQTT command to open exit gate upon successful payment.

## Phase 7: Polish and Optimization
- [ ] Add loading states and error notifications (e.g., using `react-toastify` or `sonner`).
- [ ] Ensure responsive design.
- [ ] Final testing using MQTT Explorer to simulate ESP32 scans.
