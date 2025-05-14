import React, { useState, useEffect, useRef } from 'react';
import { createGroup, searchFriend } from '../services/api';
import '../css/CreateGroup.css';

const CreateGroup = ({ onSuccess, onBack }) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const inputRef = useRef(null); // Ref để focus vào input

  // Xử lý bàn phím ảo trên thiết bị di động
  useEffect(() => {
    const handleResize = () => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearchUsers = async () => {
    try {
      const { data } = await searchFriend(null, searchQuery); // Gửi query name thay vì phone
      setSearchedUsers(data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Tìm kiếm người dùng thất bại.');
    }
  };

  const handleAddMember = (user) => {
    if (!selectedMembers.find((member) => member._id === user._id)) {
      setSelectedMembers([...selectedMembers, user]);
    }
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((member) => member._id !== userId));
  };

  const handleCreateGroup = async () => {
    try {
      const memberIds = selectedMembers.map((member) => member._id);
      const { data } = await createGroup({ name: groupName, memberIds });

      if (onSuccess) {
        onSuccess(data); // Truyền nhóm mới cho Home
      }

      alert('Tạo nhóm thành công!');
    } catch (err) {
      console.error('Error creating group:', err);
      if (err.response?.status === 500) {
        alert('Nhóm đã được tạo, nhưng có lỗi xảy ra. Vui lòng kiểm tra danh sách nhóm.');
        if (onBack) onBack(); // Quay lại màn hình chat nếu có lỗi 500
      } else {
        alert(err.response?.data?.msg || 'Tạo nhóm thất bại.');
      }
    }
  };

  return (
    <div className="create-group">
      <div className="create-group-container">
        <div className="create-group-header">
          <button className="back-button" onClick={onBack}>
            ←
          </button>
          <h2>Tạo nhóm mới</h2>
        </div>
        <div className="create-group-content">
          <div className="form-group">
            <label>Tên nhóm:</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nhập tên nhóm"
              ref={inputRef}
            />
          </div>
          <div className="form-group">
            <label>Thêm thành viên:</label>
            <div className="search-bar">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bạn bè bằng tên"
                ref={inputRef}
              />
              <button onClick={handleSearchUsers}>Tìm</button>
            </div>
          </div>
          {searchedUsers.length > 0 && (
            <div className="searched-users">
              <h4>Kết quả tìm kiếm:</h4>
              {searchedUsers.map((user) => (
                <div key={user._id} className="user-item">
                  <span>{user.name}</span>
                  <button onClick={() => handleAddMember(user)}>Thêm</button>
                </div>
              ))}
            </div>
          )}
          {selectedMembers.length > 0 && (
            <div className="selected-members">
              <h4>Thành viên đã chọn:</h4>
              {selectedMembers.map((member) => (
                <div key={member._id} className="member-item">
                  <span>{member.name}</span>
                  <button onClick={() => handleRemoveMember(member._id)}>Xóa</button>
                </div>
              ))}
            </div>
          )}
          <div className="form-actions">
            <button onClick={handleCreateGroup} disabled={!groupName}>
              Tạo nhóm
            </button>
            <button onClick={onBack}>Hủy</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroup;