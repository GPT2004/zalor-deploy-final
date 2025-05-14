const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // Thêm path để phục vụ file tĩnh
require('dotenv').config();
const authRoutes = require('./routes/auth');
const friendsRoutes = require('./routes/friends');
const usersRoutes = require('./routes/users');
const groupsRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const User = require('./models/User'); // Import model User để cập nhật trạng thái

process.env.LANG = 'en_US.UTF-8';

const app = express();
const server = http.createServer(app);

// Cấu hình Socket.IO với CORS động
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Sử dụng biến môi trường
    methods: ['GET', 'POST'],
  },
});

// Gắn Socket.IO vào app để sử dụng trong routes
app.set('socketio', io);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Chỉ cho phép từ domain frontend
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Phục vụ file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/messages', messageRoutes);

// Định tuyến tất cả các yêu cầu không phải API về index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Khi người dùng đăng nhập (gửi userId từ client)
  socket.on('userConnected', async (userId) => {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.error(`Invalid userId received:`, userId);
        return;
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: true },
        { new: true }
      );

      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return;
      }

      socket.userId = userId;
      io.emit('userStatus', { userId, isOnline: true });
      console.log(`User ${userId} is online`);
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  });

  // Tham gia phòng chat (1-1 hoặc nhóm)
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId || 'unknown'} joined room: ${roomId}`);
  });

  // Xử lý gửi tin nhắn
  socket.on('sendMessage', (message) => {
    try {
      const { roomId, receiverId, isGroup, ...msg } = message;

      if (!roomId || !receiverId) {
        console.error('Missing roomId or receiverId in message:', message);
        return;
      }

      // Phát tin nhắn đến tất cả người dùng trong room (bao gồm cả người gửi)
      io.to(roomId).emit('sendMessage', {
        ...msg,
        receiverId,
        isGroup,
        createdAt: new Date().toISOString(), // Đảm bảo timestamp
      });

      console.log(`Message sent to room ${roomId} by user ${socket.userId}`);
    } catch (err) {
      console.error('Error handling sendMessage:', err);
    }
  });

  // Khi người dùng ngắt kết nối
  socket.on('disconnect', async () => {
    try {
      if (socket.userId) {
        // Cập nhật trạng thái offline trong cơ sở dữ liệu
        const user = await User.findByIdAndUpdate(
          socket.userId,
          { isOnline: false },
          { new: true }
        );
        if (!user) {
          console.error(`User with ID ${socket.userId} not found`);
          return;
        }

        // Thông báo trạng thái offline đến tất cả client
        io.emit('userStatus', { userId: socket.userId, isOnline: false });
        console.log(`User ${socket.userId} is offline`);
      }
    } catch (err) {
      console.error('Error updating offline status:', err);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));