import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';
import {
  getFriendRequests,
  getFriends,
  updateFriendRequest,
  getCurrentUser,
  getGroups,
  leaveGroup,
  deleteGroup,
  getMessages,
  markMessagesAsRead,
  sendMessage as apiSendMessage,
  recallMessage as apiRecallMessage,
  editMessage as apiEditMessage,
} from '../services/api';
import EditGroup from './EditGroup';
import Profile from './Profile';
import CreateGroup from './CreateGroup';
import Friends from './Friends';
import Settings from './Settings';
import '../css/Home.css';

const Home = ({ onLogout, setIsAuthenticated, socket, userId }) => {
  const navigate = useNavigate();
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [searchedGroups, setSearchedGroups] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState({});
  const [showEmojiReactions, setShowEmojiReactions] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [friendMessages, setFriendMessages] = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData } = await getCurrentUser();
        setUser(userData || null);

        const { data: requests } = await getFriendRequests();
        setFriendRequests(requests || []);

        const { data: friendsData } = await getFriends();
        setFriends(friendsData || []);

        const { data: groupsData } = await getGroups();
        setGroups(groupsData || []);

        const friendMessagesData = {};
        for (const friend of friendsData) {
          try {
            const { data: messages } = await getMessages(friend._id, false);
            friendMessagesData[friend._id] = Array.isArray(messages) ? messages : [];
          } catch (err) {
            console.error(`Error fetching messages for friend ${friend._id}:`, err);
            friendMessagesData[friend._id] = [];
          }
        }
        setFriendMessages(friendMessagesData);

        const groupMessagesData = {};
        for (const group of groupsData) {
          try {
            const { data: messages } = await getMessages(group._id, true);
            groupMessagesData[group._id] = Array.isArray(messages) ? messages : [];
          } catch (err) {
            console.error(`Error fetching messages for group ${group._id}:`, err);
            groupMessagesData[group._id] = [];
          }
        }
        setGroupMessages(groupMessagesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          navigate('/login');
        } else {
          setFriendRequests([]);
          setFriends([]);
          setGroups([]);
          setUser(null);
          setFriendMessages({});
          setGroupMessages({});
        }
      }
    };
    fetchData();
  }, [navigate, setIsAuthenticated]);

  useEffect(() => {
    if (userId) {
      socket.emit('userConnected', userId);
    }
  }, [userId, socket]);

  useEffect(() => {
    const handleMessageRead = ({ receiverId, senderId }) => {
      if (!selectedChat || !user || !user._id) return;

      if (!selectedChat.isGroup && selectedChat._id === receiverId && user._id === senderId) {
        setFriendMessages((prev) => ({
          ...prev,
          [receiverId]: Array.isArray(prev[receiverId])
            ? prev[receiverId].map((msg) => ({ ...msg, isRead: true }))
            : [],
        }));
        setMessages((prev) =>
          Array.isArray(prev) ? prev.map((msg) => ({ ...msg, isRead: true })) : []
        );
      } else if (selectedChat.isGroup && selectedChat._id === receiverId) {
        setGroupMessages((prev) => ({
          ...prev,
          [receiverId]: Array.isArray(prev[receiverId])
            ? prev[receiverId].map((msg) => ({ ...msg, isRead: true }))
            : [],
        }));
        setMessages((prev) =>
          Array.isArray(prev) ? prev.map((msg) => ({ ...msg, isRead: true })) : []
        );
      }
    };

    socket.on('messageRead', handleMessageRead);
    return () => socket.off('messageRead', handleMessageRead);
  }, [selectedChat, user, socket]);

  useEffect(() => {
    const handleUserStatus = ({ userId, isOnline }) => {
      setFriends((prev) =>
        Array.isArray(prev)
          ? prev.map((friend) => (friend._id === userId ? { ...friend, isOnline } : friend))
          : []
      );
      setFriendRequests((prev) =>
        Array.isArray(prev)
          ? prev.map((req) =>
              req.from._id === userId ? { ...req, from: { ...req.from, isOnline } } : req
            )
          : []
      );
      if (selectedChat && selectedChat._id === userId) {
        setSelectedChat((prev) => (prev ? { ...prev, isOnline } : null));
      }
    };

    socket.on('userStatus', handleUserStatus);
    return () => socket.off('userStatus', handleUserStatus);
  }, [selectedChat, socket]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      if (!message || !message.receiverId) return;
  
      if (messages.some((msg) => msg._id === message._id)) return;
  
      if (message.isGroup) {
        setGroupMessages((prev) => ({
          ...prev,
          [message.receiverId]: Array.isArray(prev[message.receiverId])
            ? [...prev[message.receiverId], { ...message, isRead: user?._id !== message.senderId?._id }]
            : [{ ...message, isRead: user?._id !== message.senderId?._id }],
        }));
      } else {
        const senderId = message.senderId?._id || message.senderId;
        const friendId = senderId === user?._id ? message.receiverId : senderId;
  
        setFriendMessages((prev) => ({
          ...prev,
          [friendId]: Array.isArray(prev[friendId])
            ? [...prev[friendId], { ...message, isRead: user?._id !== message.senderId?._id }]
            : [{ ...message, isRead: user?._id !== message.senderId?._id }],
        }));
      }
  
      if (selectedChat && selectedChat._id === message.receiverId) {
        setMessages((prev) => {
          if (!Array.isArray(prev) || prev.some((msg) => msg._id === message._id)) return prev;
          return [...prev, { ...message, isRead: user?._id !== message.senderId?._id }];
        });
      }
    };
  
    socket.on('sendMessage', handleReceiveMessage); // Lắng nghe sự kiện sendMessage
    return () => socket.off('sendMessage', handleReceiveMessage);
  }, [user, selectedChat, socket, messages]);

  useEffect(() => {
    if (selectedChat && user && user._id && selectedChat._id) {
      const roomId = selectedChat.isGroup
        ? selectedChat._id
        : [user._id, selectedChat._id].sort().join('-');
      socket.emit('joinRoom', roomId);

      const fetchMessages = async () => {
        try {
          const { data } = await getMessages(selectedChat._id, selectedChat.isGroup);
          const messagesArray = Array.isArray(data) ? data : [];
          setMessages(messagesArray);
          if (selectedChat.isGroup) {
            setGroupMessages((prev) => ({
              ...prev,
              [selectedChat._id]: messagesArray,
            }));
          } else {
            setFriendMessages((prev) => ({
              ...prev,
              [selectedChat._id]: messagesArray,
            }));
          }
        } catch (err) {
          console.error('Error fetching messages:', err);
          setMessages([]);
        }
      };

      fetchMessages();
    }
  }, [selectedChat, user, socket]);

  const markAsRead = async () => {
    if (
      selectedChat &&
      user &&
      user._id &&
      Array.isArray(messages) &&
      messages.some((msg) => !msg.isRead && msg.senderId?._id !== user._id)
    ) {
      try {
        await markMessagesAsRead(selectedChat._id, selectedChat.isGroup);
        setMessages((prev) => prev.map((msg) => ({ ...msg, isRead: true })));
        if (selectedChat.isGroup) {
          setGroupMessages((prev) => ({
            ...prev,
            [selectedChat._id]: Array.isArray(prev[selectedChat._id])
              ? prev[selectedChat._id].map((msg) => ({ ...msg, isRead: true }))
              : [],
          }));
        } else {
          setFriendMessages((prev) => ({
            ...prev,
            [selectedChat._id]: Array.isArray(prev[selectedChat._id])
              ? prev[selectedChat._id].map((msg) => ({ ...msg, isRead: true }))
              : [],
          }));
        }
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const handleAddFriend = () => {
    setCurrentView('friends');
    setSelectedChat(null);
    setSelectedProfile(null);
    setSelectedGroup(null);
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleProfileDropdown = () => setIsProfileDropdownOpen(!isProfileDropdownOpen);

  const handleProfileInfo = () => {
    setSelectedProfile(user || null);
    setSelectedChat(null);
    setSelectedGroup(null);
    setCurrentView('chat');
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
    setIsProfileDropdownOpen(false);
  };

  const handleCreateGroupPage = () => {
    setCurrentView('create-group');
    setSelectedChat(null);
    setSelectedProfile(null);
    setSelectedGroup(null);
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await updateFriendRequest(requestId, 'accepted');
      setFriendRequests(friendRequests.filter((req) => req._id !== requestId));
      const { data: friendsData } = await getFriends();
      setFriends(friendsData || []);
      alert('Đã chấp nhận lời mời!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Chấp nhận lời mời thất bại.');
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await updateFriendRequest(requestId, 'declined');
      setFriendRequests(friendRequests.filter((req) => req._id !== requestId));
      alert('Đã từ chối lời mời!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Từ chối lời mời thất bại.');
    }
  };

  const handleSearchGroups = () => {
    if (!searchGroupQuery.trim()) {
      setSearchedGroups([]);
      return;
    }

    const lowerQuery = searchGroupQuery.toLowerCase();
    const filteredFriends = friends
      .filter((friend) => friend.name.toLowerCase().includes(lowerQuery))
      .map((friend) => ({ ...friend, type: 'friend' }));
    const filteredGroups = groups
      .filter((group) => group.name.toLowerCase().includes(lowerQuery))
      .map((group) => ({ ...group, type: 'group' }));
    setSearchedGroups([...filteredFriends, ...filteredGroups]);
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      await leaveGroup(groupId);
      setGroups(groups.filter((group) => group._id !== groupId));
      setSelectedGroup(null);
      setSelectedChat(null);
      alert('Rời nhóm thành công!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Rời nhóm thất bại.');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      await deleteGroup(groupId);
      setGroups(groups.filter((group) => group._id !== groupId));
      setSelectedGroup(null);
      setSelectedChat(null);
      alert('Xóa nhóm thành công!');
    } catch (err) {
      console.error('Error deleting group:', err);
      alert(err.response?.data?.msg || 'Xóa nhóm thất bại. Vui lòng thử lại.');
    }
  };

  const handleShowGroupInfo = (group) => {
    setSelectedGroup(group);
    setSelectedChat(null);
    setSelectedProfile(null);
    setCurrentView('chat');
  };

  const handleSelectChat = async (chat, isGroup = false) => {
    if (!chat || !chat._id) return;
    setSelectedChat({ ...chat, isGroup });
    setSelectedProfile(null);
    setSelectedGroup(null);
    setCurrentView('chat');
    if (Array.isArray(messages) && messages.some((msg) => !msg.isRead && msg.senderId?._id !== user?._id)) {
      await markAsRead();
    }
  };

  const handleShowProfile = (userId) => {
    const friend = friends.find((f) => f._id === userId);
    if (friend) {
      setSelectedProfile(friend);
      setSelectedChat(null);
      setSelectedGroup(null);
      setCurrentView('chat');
    } else {
      console.error('Friend not found in friends list:', userId);
      alert('Không tìm thấy thông tin người dùng này trong danh sách bạn bè.');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() && !file) return;
  
    if (!selectedChat || !selectedChat._id || !user || !user._id) {
      console.error('Cannot send message: selectedChat or user is null', { selectedChat, user });
      return;
    }
  
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      senderId: user,
      content: message,
      type: file
        ? file.type.startsWith('image')
          ? 'image'
          : file.type.startsWith('video')
          ? 'video'
          : 'file'
        : 'text',
      createdAt: new Date().toISOString(),
      isRecalled: false,
      isRead: true,
    };
  
    setMessages((prev) => [...prev, tempMessage]);
  
    try {
      const newMessage = await apiSendMessage(selectedChat._id, selectedChat.isGroup, message, file);
      setMessages((prev) =>
        prev
          .filter((msg) => msg._id !== tempId)
          .concat(newMessage)
      );
  
      if (selectedChat.isGroup) {
        setGroupMessages((prev) => ({
          ...prev,
          [selectedChat._id]: Array.isArray(prev[selectedChat._id])
            ? [...prev[selectedChat._id], newMessage]
            : [newMessage],
        }));
      } else {
        setFriendMessages((prev) => ({
          ...prev,
          [selectedChat._id]: Array.isArray(prev[selectedChat._id])
            ? [...prev[selectedChat._id], newMessage]
            : [newMessage],
        }));
      }
  
      // Emit tin nhắn qua socket
      const roomId = selectedChat.isGroup
        ? selectedChat._id
        : [user._id, selectedChat._id].sort().join('-');
      socket.emit('sendMessage', {
        ...newMessage,
        receiverId: selectedChat._id,
        isGroup: selectedChat.isGroup,
        roomId,
      });
  
      setMessage('');
      setFile(null);
      setPreview(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
    }
  };

  const recallMessage = async (messageId) => {
    try {
      await apiRecallMessage(messageId);
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, isRecalled: true } : msg))
      );
      setShowMessageOptions(null);
    } catch (err) {
      console.error('Error recalling message:', err);
    }
  };

  const editMessage = async (messageId, newContent) => {
    try {
      await apiEditMessage(messageId, newContent);
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, content: newContent } : msg))
      );
      setShowMessageOptions(null);
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  };

  const removePreview = () => {
    setFile(null);
    setPreview(null);
    if (preview) URL.revokeObjectURL(preview);
  };

  const toggleEmojiPicker = () => setShowEmojiPicker(!showEmojiPicker);

  const handleEmojiSelect = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleMessageOptions = (messageId) => {
    setShowMessageOptions(messageId === showMessageOptions ? null : messageId);
  };

  const handleEmojiReaction = (messageId, emoji) => {
    setSelectedEmoji((prev) => ({
      ...prev,
      [messageId]: emoji,
    }));
    setShowEmojiReactions(null);
  };

  const toggleEmojiReactions = (messageId) => {
    setShowEmojiReactions(messageId === showEmojiReactions ? null : messageId);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getDisplayMessage = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    return messages[messages.length - 1];
  };

  const hasUnreadMessages = (messages) => {
    if (!Array.isArray(messages)) return false;
    return messages.some((msg) => msg?.senderId?._id !== user?._id && !msg.isRead);
  };

  return (
    <div className="home-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>Zalor</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Tìm kiếm bạn bè hoặc nhóm"
              value={searchGroupQuery}
              onChange={(e) => setSearchGroupQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchGroups()}
            />
            <button onClick={handleSearchGroups}>Tìm</button>
          </div>
          {searchedGroups.length > 0 && (
            <div className="search-results">
              <h4>Kết quả tìm kiếm:</h4>
              {searchedGroups.map((item) => (
                <div
                  key={item._id}
                  className={`friend-item ${selectedChat && selectedChat._id === item._id ? 'active' : ''}`}
                >
                  {item.type === 'friend' ? (
                    <div className="friend-info" onClick={() => handleSelectChat(item, false)}>
                      <div className="friend-avatar-container">
                        <img
                          src={item.avatar || 'https://via.placeholder.com/30'}
                          alt="Avatar"
                          className="friend-avatar"
                        />
                        <span
                          className={`status-indicator ${item.isOnline ? 'status-online' : 'status-offline'}`}
                        ></span>
                      </div>
                      <div className="friend-name-container">
                        <span className="friend-name">{item.name || 'Không xác định'}</span>
                        {friendMessages[item._id] && friendMessages[item._id].length > 0 && (
                          <span className="last-message">
                            {getDisplayMessage(friendMessages[item._id])?.content}
                          </span>
                        )}
                      </div>
                      {hasUnreadMessages(friendMessages[item._id]) && <span className="unread-indicator"></span>}
                    </div>
                  ) : (
                    <div className="group-info">
                      <div className="group-info-content" onClick={() => handleSelectChat(item, true)}>
                        <div className="friend-avatar-container">
                          <img
                            src={item.avatar || 'https://via.placeholder.com/30'}
                            alt="Group Avatar"
                            className="friend-avatar"
                          />
                        </div>
                        <div className="friend-name-container">
                          <span className="friend-name">{item.name || 'Tên nhóm không xác định'}</span>
                          {groupMessages[item._id] && groupMessages[item._id].length > 0 && (
                            <span className="last-message">
                              {getDisplayMessage(groupMessages[item._id])?.content}
                            </span>
                          )}
                        </div>
                        {hasUnreadMessages(groupMessages[item._id]) && <span className="unread-indicator"></span>}
                      </div>
                      <button className="info-button" onClick={() => handleShowGroupInfo(item)}>...</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="tabs">
            <button className="friend-request-text" onClick={toggleDropdown}>
              Lời mời kết bạn {friendRequests.length > 0 && `(${friendRequests.length})`}
            </button>
            <button className="active">Tất cả</button>
          </div>
        </div>
        <div className="sidebar-content">
          <div className="friend-requests">
            <div className="dropdown">
              {isDropdownOpen && (
                <div className="dropdown-content">
                  {friendRequests.length > 0 ? (
                    friendRequests.map((request) => (
                      <div key={request._id} className="request-item">
                        <div className="request-info">
                          <div className="request-avatar-container">
                            <img
                              src={request.from?.avatar || 'https://via.placeholder.com/30'}
                              alt="Avatar"
                              className="request-avatar"
                            />
                            <span
                              className={`status-indicator ${request.from?.isOnline ? 'status-online' : 'status-offline'}`}
                            ></span>
                          </div>
                          <span>{request.from?.name || 'Không xác định'}</span>
                        </div>
                        <div className="request-actions">
                          <button onClick={() => handleAcceptRequest(request._id)}>Đồng ý</button>
                          <button onClick={() => handleDeclineRequest(request._id)}>Từ chối</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>Chưa có lời mời kết bạn nào.</p>
                  )}
                </div>
              )}
            </div>
            <div className="section-header">
              <h3>BẠN BÈ</h3>
              <button className="add-button" onClick={handleAddFriend}>+</button>
            </div>
            <div className="friends-list">
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <div
                    key={friend._id}
                    className={`friend-item ${selectedChat && selectedChat._id === friend._id ? 'active' : ''}`}
                    onClick={() => handleSelectChat(friend, false)}
                  >
                    <div className="friend-info">
                      <div className="friend-avatar-container">
                        <img
                          src={friend.avatar || 'https://via.placeholder.com/30'}
                          alt="Avatar"
                          className="friend-avatar"
                        />
                        <span
                          className={`status-indicator ${friend.isOnline ? 'status-online' : 'status-offline'}`}
                        ></span>
                      </div>
                      <div className="friend-name-container">
                        <span className="friend-name">{friend.name || 'Không xác định'}</span>
                        {friendMessages[friend._id] && friendMessages[friend._id].length > 0 && (
                          <span className="last-message">
                            {getDisplayMessage(friendMessages[friend._id])?.content}
                          </span>
                        )}
                      </div>
                      {hasUnreadMessages(friendMessages[friend._id]) && <span className="unread-indicator"></span>}
                    </div>
                  </div>
                ))
              ) : (
                <p>Chưa có bạn bè nào.</p>
              )}
            </div>
          </div>
          <div className="groups">
            <div className="section-header">
              <h3>NHÓM</h3>
              <button className="add-button" onClick={handleCreateGroupPage}>+</button>
            </div>
            <div className="groups-list">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div
                    key={group._id}
                    className={`friend-item ${selectedChat && selectedChat._id === group._id ? 'active' : ''}`}
                  >
                    <div className="group-info">
                      <div className="group-info-content" onClick={() => handleSelectChat(group, true)}>
                        <div className="friend-avatar-container">
                          <img
                            src={group.avatar || 'https://via.placeholder.com/30'}
                            alt="Group Avatar"
                            className="friend-avatar"
                          />
                        </div>
                        <div className="friend-name-container">
                          <span className="friend-name">{group.name || 'Tên nhóm không xác định'}</span>
                          {groupMessages[group._id] && groupMessages[group._id].length > 0 && (
                            <span className="last-message">
                              {getDisplayMessage(groupMessages[group._id])?.content}
                            </span>
                          )}
                        </div>
                        {hasUnreadMessages(groupMessages[group._id]) && <span className="unread-indicator"></span>}
                      </div>
                      <button className="info-button" onClick={() => handleShowGroupInfo(group)}>...</button>
                    </div>
                  </div>
                ))
              ) : (
                <p>Bạn chưa tham gia nhóm nào.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-header">
          <div className="chat-header-info">
            {selectedChat && !selectedProfile && !selectedGroup && currentView === 'chat' && (
              <>
                <div className="chat-header-avatar-container">
                  <img
                    src={selectedChat.avatar || 'https://via.placeholder.com/40'}
                    alt="Avatar"
                    className="chat-header-avatar"
                  />
                  <span
                    className={`status-indicator ${selectedChat.isOnline ? 'status-online' : 'status-offline'}`}
                  ></span>
                </div>
                <h2
                  onClick={() => !selectedChat.isGroup && handleShowProfile(selectedChat._id)}
                  style={{ cursor: !selectedChat.isGroup ? 'pointer' : 'default' }}
                >
                  {selectedChat.name}
                </h2>
              </>
            )}
            {selectedProfile && currentView === 'chat' && (
              <>
                <div className="chat-header-avatar-container">
                  <img
                    src={selectedProfile.avatar || 'https://via.placeholder.com/40'}
                    alt="Avatar"
                    className="chat-header-avatar"
                  />
                  <span
                    className={`status-indicator ${selectedProfile.isOnline ? 'status-online' : 'status-offline'}`}
                  ></span>
                </div>
                <h2>{selectedProfile.name}</h2>
              </>
            )}
            {selectedGroup && currentView === 'chat' && (
              <>
                <div className="chat-header-avatar-container">
                  <img
                    src={selectedGroup.avatar || 'https://via.placeholder.com/40'}
                    alt="Group Avatar"
                    className="chat-header-avatar"
                  />
                </div>
                <h2>{selectedGroup.name}</h2>
              </>
            )}
            {currentView === 'create-group' && <h2>Tạo nhóm mới</h2>}
            {currentView === 'friends' && <h2>Tìm kiếm bạn bè</h2>}
          </div>
          <div className="profile-dropdown">
            <img
              src={user?.avatar || 'https://via.placeholder.com/40'}
              alt="Avatar"
              className="profile-avatar"
              onClick={toggleProfileDropdown}
            />
            {isProfileDropdownOpen && (
              <div className="profile-dropdown-content">
                <div className="profile-options">
                  <span className="icon profile-icon" onClick={handleProfileInfo}>👤</span>
                  <span className="icon settings-icon" onClick={handleSettings}>⚙️</span>
                  <span className="icon logout-icon" onClick={handleLogout}>🚪</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="chat-container">
          <div className="chat-area">
            {currentView === 'create-group' ? (
              <CreateGroup
                onBack={() => setCurrentView('chat')}
                onSuccess={(newGroup) => {
                  setGroups((prev) => [...prev, newGroup]);
                  setCurrentView('chat');
                }}
              />
            ) : currentView === 'friends' ? (
              <Friends
                onBack={() => setCurrentView('chat')}
                onSuccess={() => {
                  getFriends().then(({ data }) => setFriends(data || []));
                  setCurrentView('chat');
                }}
              />
            ) : selectedProfile ? (
              <Profile
                userId={selectedProfile._id}
                currentUser={user}
                onUpdateAvatar={(newAvatar) => {
                  setUser((prev) => (prev ? { ...prev, avatar: newAvatar } : prev));
                }}
              />
            ) : selectedGroup ? (
              <EditGroup
                group={selectedGroup}
                user={user}
                onLeaveGroup={handleLeaveGroup}
                onDeleteGroup={handleDeleteGroup}
                onUpdateGroup={(updatedGroup) => {
                  setGroups(groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)));
                  setSelectedGroup(updatedGroup);
                }}
              />
            ) : selectedChat ? (
              <div className="chat-box">
                <div className="messages" ref={messagesEndRef}>
                  {Array.isArray(messages) &&
                    messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`message ${(msg.senderId?._id || msg.senderId) === user?._id ? 'sent' : 'received'}`}
                      >
                        {(msg.senderId?._id || msg.senderId) !== user?._id && (
                          <img
                            src={msg.senderId?.avatar || 'https://via.placeholder.com/30'}
                            alt="Avatar"
                            className="message-avatar"
                          />
                        )}
                        <div className="message-content">
                          {(msg.senderId?._id || msg.senderId) !== user?._id && (
                            <span className="message-sender">{msg.senderId?.name}</span>
                          )}
                          {msg.isRecalled ? (
                            <p className="recalled-message">Tin nhắn đã bị thu hồi</p>
                          ) : (
                            <>
                              {msg.type === 'text' && <p>{msg.content}</p>}
                              {msg.type === 'image' && (
                                <img src={msg.content} alt="Sent" className="message-media" />
                              )}
                              {msg.type === 'video' && (
                                <video controls src={msg.content} className="message-media" />
                              )}
                              {msg.type === 'file' && (
                                <div className="file-message">
                                  <a
                                    href={msg.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="file-link"
                                  >
                                    <span className="file-icon">📄</span>
                                    <span className="file-text">{msg.fileName || 'Tải file'}</span>
                                  </a>
                                </div>
                              )}
                              {msg.type === 'emoji' && <p>{msg.content}</p>}
                              <div className="message-footer">
                                <span className="message-time">{formatTime(msg.createdAt)}</span>
                                {selectedEmoji[msg._id] && (
                                  <span className="message-emoji-reaction">{selectedEmoji[msg._id]} 1</span>
                                )}
                                <div className="message-reaction">
                                  <button className="like-button" onClick={() => toggleEmojiReactions(msg._id)}>
                                    👍
                                  </button>
                                  {showEmojiReactions === msg._id && (
                                    <div className="emoji-reaction-picker">
                                      <button onClick={() => handleEmojiReaction(msg._id, '👍')}>👍</button>
                                      <button onClick={() => handleEmojiReaction(msg._id, '❤️')}>❤️</button>
                                      <button onClick={() => handleEmojiReaction(msg._id, '😂')}>😂</button>
                                      <button onClick={() => handleEmojiReaction(msg._id, '😮')}>😮</button>
                                      <button onClick={() => handleEmojiReaction(msg._id, '😢')}>😢</button>
                                      <button onClick={() => handleEmojiReaction(msg._id, '😡')}>😡</button>
                                    </div>
                                  )}
                                </div>
                                {(msg.senderId?._id || msg.senderId) === user?._id && (
                                  <div className="message-options">
                                    <button onClick={() => handleMessageOptions(msg._id)}>...</button>
                                    {showMessageOptions === msg._id && (
                                      <div className="chat-message-options-dropdown">
                                        <button onClick={() => recallMessage(msg._id)}>Thu hồi</button>
                                        <button
                                          onClick={() =>
                                            editMessage(msg._id, prompt('Nhập nội dung mới:', msg.content))
                                          }
                                        >
                                          Chỉnh sửa
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
                <div className="message-input">
                  <button className="icon-button" onClick={toggleEmojiPicker}>
                    😊
                  </button>
                  {showEmojiPicker && (
                    <div className="emoji-picker">
                      <EmojiPicker onEmojiClick={handleEmojiSelect} />
                    </div>
                  )}
                  <input
                    type="file"
                    id="image-upload"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                  />
                  <label htmlFor="image-upload" className="icon-button">
                    📷
                  </label>
                  <input
                    type="file"
                    id="file-upload"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept=".doc,.docx,.pdf,.txt"
                  />
                  <label htmlFor="file-upload" className="icon-button">
                    📎
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button className="send-button" onClick={sendMessage}>
                    ➤
                  </button>
                </div>
                {preview && (
                  <div className="preview-container">
                    {file.type.startsWith('image') ? (
                      <img src={preview} alt="Preview" className="preview-media" />
                    ) : file.type.startsWith('video') ? (
                      <video src={preview} controls className="preview-media" />
                    ) : (
                      <p>{file.name}</p>
                    )}
                    <button className="remove-preview" onClick={removePreview}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>Chọn một cuộc trò chuyện để bắt đầu.</p>
            )}
          </div>
          {showSettingsModal && (
            <Settings
              setIsAuthenticated={setIsAuthenticated}
              onClose={() => setShowSettingsModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;