import axios from 'axios';

const API = axios.create({
  baseURL: '', // Để trống để dùng cùng domain trên Render
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Auth
export const register = (data) => API.post('/api/auth/register', data);
export const login = (data) => API.post('/api/auth/login', data);
export const changePassword = (data) => API.put('/api/auth/me/password', data);
export const deleteAccount = () => API.delete('/api/auth/me');
export const updateSettings = (data) => API.put('/api/auth/me/settings', data);

// Users
export const getCurrentUser = () => API.get('/api/users/me');
export const getUserById = (id) => API.get(`/api/users/${id}`);
export const updateProfile = (formData) => API.put('/api/users/me', formData);

// Friends
export const searchUser = (phone, name) => {
  const query = phone ? `phone=${phone}` : name ? `name=${name}` : '';
  return API.get(`/api/friends/search?${query}`);
};
export const searchFriend = (phone, name) => {
  const query = name ? `name=${name}` : '';
  return API.get(`/api/friends/search-friends?${query}`);
};
export const sendFriendRequest = (friendId) => API.post('/api/friends/requests', { friendId });
export const getFriendRequests = () => API.get('/api/friends/requests');
export const getFriends = () => API.get('/api/friends');
export const updateFriendRequest = (requestId, status) =>
  API.patch(`/api/friends/requests/${requestId}`, { status });

// Groups
export const updateGroup = (groupId, data) => API.patch(`/api/groups/${groupId}`, data);
export const createGroup = (data) => API.post('/api/groups', data);
export const getGroups = (search = '') => API.get(`/api/groups${search ? `?search=${search}` : ''}`);
export const joinGroup = (groupId, userId) => API.post(`/api/groups/${groupId}/members`, { userId });
export const leaveGroup = (groupId) => API.delete(`/api/groups/${groupId}/members`);
export const removeMember = (groupId, memberId) => API.delete(`/api/groups/${groupId}/members/${memberId}`);
export const deleteGroup = (groupId) => API.delete(`/api/groups/${groupId}`);

// Messages
export const getMessages = (id, isGroup) =>
  API.get(`/api/messages/${id}?isGroup=${isGroup}`);
export const markMessagesAsRead = (id, isGroup) =>
  API.post(`/api/messages/mark-read/${id}`, { isGroup });
export const sendMessage = (receiverId, isGroup, content, file) => {
  const formData = new FormData();
  formData.append('receiverId', receiverId);
  formData.append('content', content);
  formData.append('isGroup', isGroup);
  if (file) {
    formData.append('file', file);
  }
  return API.post('/api/messages', formData).then((res) => res.data);
};
export const recallMessage = (messageId) => API.delete(`/api/messages/${messageId}`);
export const editMessage = (messageId, content) =>
  API.put(`/api/messages/${messageId}`, { content });