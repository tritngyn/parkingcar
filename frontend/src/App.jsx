import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Route bảo vệ kiểm tra sự tồn tại của Token (ID 7)
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
