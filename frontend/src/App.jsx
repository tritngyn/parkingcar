import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserDashboard from './pages/UserDashboard';

// Route bảo vệ kiểm tra sự tồn tại của Token (ID 7)
function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem("admin_token");
  const userStr = localStorage.getItem("admin_user");
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (role && user.role !== role) {
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Admin Dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute role="admin">
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* User Dashboard */}
        <Route path="/user-dashboard" element={
          <ProtectedRoute role="user">
            <UserDashboard />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
