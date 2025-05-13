import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './pages/Home';
import Login from './pages/Login';
import Friends from './pages/Friends';
import Profile from './pages/Profile';
import CreateGroup from './pages/CreateGroup';
import Settings from './pages/Settings';
import Register from './pages/Register';

// Khởi tạo kết nối Socket.IO
const socket = io(); // Không cần chỉ định URL vì frontend và backend chạy cùng domain trên Render

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null); // Lưu userId để gửi qua Socket.IO

  useEffect(() => {
    // Kiểm tra token khi ứng dụng khởi động
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId'); // Giả sử bạn lưu userId khi đăng nhập
    if (token && storedUserId) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
      // Thông báo trạng thái online qua Socket.IO
      socket.emit('userConnected', storedUserId);
    }
    setIsLoading(false);

    // Lắng nghe sự kiện userStatus từ backend
    socket.on('userStatus', (data) => {
      console.log('User status update:', data);
    });

    // Cleanup khi component unmount
    return () => {
      socket.off('userStatus');
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    setUserId(null);
    // Thông báo trạng thái offline qua Socket.IO
    if (userId) {
      socket.emit('userDisconnected', userId); // Tùy chọn: Nếu backend cần xử lý sự kiện này
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/home" />
            ) : (
              <Login
                setIsAuthenticated={setIsAuthenticated}
                setUserId={setUserId} // Truyền setUserId để lưu userId khi đăng nhập
              />
            )
          }
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/home" /> : <Register />}
        />
        <Route
          path="/home"
          element={
            isAuthenticated ? (
              <Home
                onLogout={handleLogout}
                setIsAuthenticated={setIsAuthenticated}
                socket={socket} // Truyền socket vào Home
                userId={userId}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/friends"
          element={
            isAuthenticated ? (
              <Friends socket={socket} userId={userId} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Profile socket={socket} userId={userId} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/create-group"
          element={
            isAuthenticated ? (
              <CreateGroup socket={socket} userId={userId} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <Settings
                setIsAuthenticated={setIsAuthenticated}
                socket={socket}
                userId={userId}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
};

export default App;