import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://localhost:5175";

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
};

const GROUP_ROOMS = [
  { id: "general", name: "General", description: "Group chat for everyone" },
];

function App() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [chatPartnerId, setChatPartnerId] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [contactError, setContactError] = useState("");
  const [roomMembers, setRoomMembers] = useState({});
  const [showRoomMembersPicker, setShowRoomMembersPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [denseMessages, setDenseMessages] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await fetch(`${API_BASE_URL}/auth/users`);

        if (!res.ok) {
          throw new Error("Failed to load users");
        }

        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Poll typing status for the current chat
  useEffect(() => {
    if (!currentUserId || (!activeRoom && !chatPartnerId)) {
      setTypingUsers([]);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const params = new URLSearchParams();
        params.set("userId", currentUserId);
        if (activeRoom) {
          params.set("roomId", activeRoom);
        } else if (chatPartnerId) {
          params.set("partnerId", chatPartnerId);
        }

        const res = await fetch(`${API_BASE_URL}/typing?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.userIds)) {
          setTypingUsers(data.userIds);
        }
      } catch {
        // ignore typing errors
      }
    };

    // initial call then interval
    poll();
    const id = setInterval(poll, 1500);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currentUserId, activeRoom, chatPartnerId]);

  // Initialize current user and chat partner once users are loaded
  useEffect(() => {
    if (!users.length) return;

    setCurrentUserId((prev) => prev || users[0]._id);

    setChatPartnerId((prev) => {
      if (prev) return prev;
      const baseUserId = currentUserId || users[0]._id;
      const firstOther = users.find((u) => u._id !== baseUserId);
      return firstOther ? firstOther._id : "";
    });
  }, [users, currentUserId]);

  useEffect(() => {
    if (!currentUserId || (!activeRoom && !chatPartnerId)) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        let url = "";
        if (activeRoom) {
          url = `${API_BASE_URL}/messages/room/${encodeURIComponent(
            activeRoom
          )}`;
        } else {
          url = `${API_BASE_URL}/messages/conversation?user1=${currentUserId}&user2=${chatPartnerId}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          // Treat 400/404 as "no messages" for this chat, not a hard error.
          if (res.status === 400 || res.status === 404) {
            if (!cancelled) {
              setMessages([]);
              setError("");
            }
            return;
          }

          const errorData = await res.json().catch(() => ({}));
          const message = errorData.error || "Failed to load messages";
          throw new Error(message);
        }

        const data = await res.json();
        if (!cancelled) {
          setMessages(data);
          // Clear any previous load error once we succeed.
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load messages");
        }
      }
    };

    const initialLoad = async () => {
      setLoadingMessages(true);
      try {
        await fetchMessages();
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    initialLoad();
    const id = setInterval(fetchMessages, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currentUserId, chatPartnerId, activeRoom]);

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmed = newMessage.trim();
    const hasTarget = !!(chatPartnerId || activeRoom);

    if (!trimmed || !currentUserId || !hasTarget) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const body = {
        senderId: currentUserId,
        content: trimmed,
      };

      if (activeRoom) {
        body.room = activeRoom;
      } else {
        body.receiverId = chatPartnerId;
      }

      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }

      const created = await res.json();
      setMessages((prev) => [...prev, created]);
      setNewMessage("");
    } catch (err) {
      setError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Send typing status to backend for current chat
  const updateTypingStatus = async (isTyping) => {
    if (!currentUserId || (!activeRoom && !chatPartnerId)) return;

    try {
      const body = {
        userId: currentUserId,
        isTyping,
      };
      if (activeRoom) {
        body.roomId = activeRoom;
      } else if (chatPartnerId) {
        body.partnerId = chatPartnerId;
      }

      await fetch(`${API_BASE_URL}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      // ignore typing errors
    }
  };

  const handleDeleteConversation = async () => {
    if (!currentUserId || (!chatPartnerId && !activeRoom)) return;

    const isGroupChat = Boolean(activeRoomMeta);

    try {
      const url = isGroupChat
        ? `${API_BASE_URL}/messages/room/${encodeURIComponent(activeRoom)}`
        : `${API_BASE_URL}/messages/conversation?user1=${currentUserId}&user2=${chatPartnerId}`;

      const options = isGroupChat
        ? { method: "DELETE" }
        : { method: "DELETE" };

      const res = await fetch(url, options);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete conversation");
      }

      setMessages([]);
    } catch (err) {
      setError(err.message || "Failed to delete conversation");
    }
  };

  const openEditProfile = () => {
    if (!currentUser) return;
    setEditName(currentUser.name || "");
    setEditEmail(currentUser.email || "");
    setShowEditProfile(true);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!currentUserId) return;

    try {
      setSavingProfile(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/auth/users/${currentUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      const data = await res.json();
      const updatedUser = data.user;

      setUsers((prev) =>
        prev.map((u) => (u._id === updatedUser._id ? updatedUser : u))
      );

      setShowEditProfile(false);
      setShowAccountMenu(false);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    if (!users.length) {
      setShowAccountMenu(false);
      return;
    }

    const first = users[0];
    setCurrentUserId(first._id);
    setChatPartnerId("");
    setActiveRoom("");
    setMessages([]);
    setShowAccountMenu(false);
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
    setShowAccountMenu(false);
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => `${prev || ""}${emoji}`);
    updateTypingStatus(true);
    setShowEmojiPicker(false);
  };

  const handleFileSelected = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setNewMessage((prev) =>
      prev ? `${prev} 📎 ${file.name}` : `📎 ${file.name}`
    );
    updateTypingStatus(true);
  };

  const handleCreateContact = async (event) => {
    event.preventDefault();

    const name = newContactName.trim();
    const email = newContactEmail.trim();

    if (!name || !email) {
      setContactError("Name and email are required");
      return;
    }

    try {
      setCreatingContact(true);
      setContactError("");

      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password: "password123",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create contact");
      }

      const data = await res.json();
      const createdUser = data.user || null;

      if (createdUser) {
        setUsers((prev) => [...prev, createdUser]);
      }

      setNewContactName("");
      setNewContactEmail("");
      setShowAddContact(false);
    } catch (err) {
      setContactError(err.message || "Failed to create contact");
    } finally {
      setCreatingContact(false);
    }
  };

  const toggleRoomMember = (roomId, userId) => {
    setRoomMembers((prev) => {
      const existing = prev[roomId] || [];
      const isMember = existing.includes(userId);
      const nextMembers = isMember
        ? existing.filter((id) => id !== userId)
        : [...existing, userId];
      return { ...prev, [roomId]: nextMembers };
    });
  };

  const currentUser = users.find((u) => u._id === currentUserId) || null;
  const chatPartner = users.find((u) => u._id === chatPartnerId) || null;

  const otherUsers = users.filter((u) => u._id !== currentUserId);

  const activeRoomMeta =
    GROUP_ROOMS.find((room) => room.id === activeRoom) || null;
  const hasActiveChat = Boolean(activeRoomMeta || chatPartnerId);

  const typingUsersDetailed = typingUsers
    .map((id) => users.find((u) => u._id === id))
    .filter(Boolean);

  let typingLabel = "";
  if (activeRoomMeta) {
    if (typingUsersDetailed.length === 1) {
      typingLabel = `${typingUsersDetailed[0].name} is typing…`;
    } else if (typingUsersDetailed.length === 2) {
      typingLabel = `${typingUsersDetailed[0].name} and ${typingUsersDetailed[1].name} are typing…`;
    } else if (typingUsersDetailed.length > 2) {
      typingLabel = "Several people are typing…";
    }
  } else if (chatPartner && typingUsersDetailed.length > 0) {
    // DM: always show the partner name
    typingLabel = `${chatPartner.name} is typing…`;
  }

  return (
    <div className="app bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="chat-layout">
        <section className="chats-sidebar glass-panel">
          {users.length > 0 && currentUser && (
            <div className="current-account-wrapper">
              <button
                type="button"
                className="current-account-trigger"
                onClick={() => setShowAccountMenu((prev) => !prev)}
              >
                <div className="current-account-main">
                  <div className="avatar-small current-account-avatar">
                    <span>{getInitials(currentUser.name)}</span>
                  </div>
                  <div className="current-account-text">
                    <div className="current-account-name">{currentUser.name}</div>
                  </div>
                </div>
                <span className="current-account-chevron">▾</span>
              </button>

              {showAccountMenu && (
                <div className="current-account-dropdown">
                  <div className="current-account-profile">
                    <div className="avatar-small current-account-avatar">
                      <span>{getInitials(currentUser.name)}</span>
                    </div>
                    <div className="current-account-text">
                      <div className="current-account-name">{currentUser.name}</div>
                      <div className="current-account-email">{currentUser.email}</div>
                    </div>
                  </div>

                  <div className="current-account-menu">
                    <button
                      type="button"
                      className="current-account-item"
                      onClick={() => {
                        openEditProfile();
                      }}
                    >
                      <span className="current-account-item-icon">✏️</span>
                      <span>Edit profile</span>
                    </button>
                    <button
                      type="button"
                      className="current-account-item"
                      onClick={handleSettingsClick}
                    >
                      <span className="current-account-item-icon">⚙️</span>
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      className="current-account-item"
                      onClick={handleLogout}
                    >
                      <span className="current-account-item-icon">⏏</span>
                      <span>Logout</span>
                    </button>
                  </div>

                  <div className="current-account-switch">
                    <div className="current-account-switch-label">Switch account</div>
                    <ul className="current-account-switch-list">
                      {users.map((user) => (
                        <li key={user._id}>
                          <button
                            type="button"
                            className={`current-account-switch-item ${
                              user._id === currentUserId ? "active" : ""
                            }`}
                            onClick={() => {
                              setCurrentUserId(user._id);
                              if (user._id === chatPartnerId) {
                                setChatPartnerId("");
                              }
                              setShowAccountMenu(false);
                            }}
                          >
                            <div className="avatar-small current-account-avatar">
                              <span>{getInitials(user.name)}</span>
                            </div>
                            <div className="current-account-text">
                              <div className="current-account-name">{user.name}</div>
                              <div className="current-account-email">{user.email}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="add-contact-row">
            <button
              type="button"
              className="add-contact-button"
              onClick={() => setShowAddContact((prev) => !prev)}
            >
              + Add contact
            </button>
          </div>

          {showAddContact && (
            <form className="add-contact-form" onSubmit={handleCreateContact}>
              <input
                type="text"
                className="add-contact-input"
                placeholder="Name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
              />
              <input
                type="email"
                className="add-contact-input"
                placeholder="Email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
              />
              <button
                type="submit"
                className="add-contact-submit"
                disabled={creatingContact}
              >
                {creatingContact ? "Adding..." : "Save"}
              </button>
              {contactError && (
                <div className="error add-contact-error">{contactError}</div>
              )}
            </form>
          )}

          <div className="sidebar-section-title">Rooms</div>
          <ul className="sidebar-conversations">
            {GROUP_ROOMS.map((room) => (
              <li
                key={room.id}
                className={`conversation-item ${
                  activeRoomMeta && activeRoomMeta.id === room.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveRoom(room.id);
                  setChatPartnerId("");
                }}
              >
                <div className="conversation-avatar-wrapper">
                  <div className="avatar-small room-avatar">
                    <span>#</span>
                  </div>
                </div>
                <div className="conversation-item-text">
                  <div className="conversation-name">{room.name}</div>
                  <div className="conversation-status">{room.description}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="sidebar-section-title">Direct messages</div>

          {loadingUsers ? (
            <p className="status">Loading users...</p>
          ) : (
            <ul className="sidebar-conversations">
              {otherUsers.length === 0 ? (
                <li className="status">No other users yet.</li>
              ) : (
                otherUsers.map((user) => (
                  <li
                    key={user._id}
                    className={`conversation-item ${
                      !activeRoom && user._id === chatPartnerId ? "active" : ""
                    }`}
                    onClick={() => {
                      setChatPartnerId(user._id);
                      setActiveRoom("");
                    }}
                  >
                    <div className="conversation-avatar-wrapper">
                      <div className="avatar-small">
                        <span>{getInitials(user.name)}</span>
                      </div>
                      <span className="status-dot online" />
                    </div>
                    <div className="conversation-item-text">
                      <div className="conversation-name">{user.name}</div>
                      <div className="conversation-status">Available</div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        <main className="chat-main glass-panel">
          <header className="conversation-header">
            {activeRoomMeta ? (
              <>
                <div className="header-user">
                  <div className="avatar-small large room-avatar">
                    <span>#</span>
                  </div>
                  <div className="header-user-text">
                    <div className="conversation-name">{activeRoomMeta.name}</div>
                    <div className="conversation-status">Group chat</div>
                  </div>
                </div>
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="add-people-btn"
                    onClick={() =>
                      setShowRoomMembersPicker((prev) => !prev)
                    }
                  >
                    + Add people
                  </button>
                  <button
                    type="button"
                    className="add-people-btn"
                    onClick={handleDeleteConversation}
                  >
                    Clear chat
                  </button>
                </div>
              </>
            ) : chatPartner ? (
              <div className="header-user">
                <div className="avatar-small large">
                  <span>{getInitials(chatPartner.name)}</span>
                </div>
                <div className="header-user-text">
                  <div className="conversation-name">{chatPartner.name}</div>
                  <div className="conversation-status">Online</div>
                </div>
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="add-people-btn"
                    onClick={handleDeleteConversation}
                  >
                    Clear chat
                  </button>
                </div>
              </div>
            ) : (
              <p className="status">Choose someone from the left to start chatting.</p>
            )}
          </header>

          {activeRoomMeta && (
            <>
              {roomMembers[activeRoomMeta.id]?.length > 0 && (
                <div className="room-members">
                  {roomMembers[activeRoomMeta.id].map((id) => {
                    const user = users.find((u) => u._id === id);
                    if (!user) return null;
                    return (
                      <div
                        key={id}
                        className="room-member-avatar"
                        title={user.name}
                      >
                        <span>{getInitials(user.name)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {showRoomMembersPicker && (
                <div className="room-members-picker">
                  <div className="room-members-title">Add people</div>
                  <div className="room-members-list">
                    {users.map((user) => {
                      const selected = (roomMembers[activeRoomMeta.id] || []).includes(
                        user._id
                      );
                      return (
                        <label
                          key={user._id}
                          className="room-members-item"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleRoomMember(activeRoomMeta.id, user._id)
                            }
                          />
                          <span>{user.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="room-members-done"
                    onClick={() => setShowRoomMembersPicker(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </>
          )}

          <div className="messages-panel">
            {loadingMessages ? (
              <p className="status">Loading messages...</p>
            ) : !currentUserId || !hasActiveChat ? (
              <p className="status">No conversation selected.</p>
            ) : messages.length === 0 ? (
              <p className="status">No messages yet. Say hi!</p>
            ) : (
              <ul
                className={`messages-list ${
                  denseMessages ? "messages-list-dense" : ""
                }`}
              >
                {messages.map((message) => {
                  const isCurrentUserSender = message.sender === currentUserId;
                  const senderUser =
                    users.find((u) => u._id === message.sender) || null;
                  const isGroupChat = Boolean(activeRoomMeta);
                  const senderName = isGroupChat
                    ? senderUser?.name || (isCurrentUserSender ? "You" : "Unknown")
                    : isCurrentUserSender
                    ? "You"
                    : senderUser?.name || "Unknown";
                  const messageClasses = [
                    "message",
                    isCurrentUserSender ? "outgoing" : "incoming",
                    isGroupChat ? "group-message" : "dm-message",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={message._id} className={messageClasses}>
                      {isGroupChat && (
                        <div className="group-message-header">
                          <div className="group-message-avatar">
                            <span>
                              {getInitials(senderUser?.name || senderName)}
                            </span>
                          </div>
                          <div className="group-message-header-text">
                            <span className="group-message-sender-name">
                              {senderName}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="message-content">{message.content}</div>
                      <div className="message-meta">
                        {!isGroupChat && (
                          <span className="message-author">{senderName}</span>
                        )}
                        {message.createdAt && (
                          <span className="message-time">
                            {new Date(message.createdAt).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {typingUsersDetailed.length > 0 && typingLabel && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
                <span className="typing-label">{typingLabel}</span>
              </div>
            )}
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker">
              {["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😍","😘","😎","😢","😭","👍","🙏"].map(
                (emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="emoji-button"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </button>
                )
              )}
            </div>
          )}

          <form className="message-input" onSubmit={handleSendMessage}>
            <div className="message-input-inner">
              <button
                type="button"
                className="icon-button"
                aria-label="Add emoji"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
              >
                😊
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Attach file"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
              >
                📎
              </button>
              <button
                type="button"
                className={`icon-button ${
                  isRecording ? "icon-button-recording" : ""
                }`}
                aria-label="Voice message"
                onClick={() => {
                  setIsRecording((prev) => {
                    const next = !prev;
                    if (!prev) {
                      setNewMessage((existing) =>
                        existing ? existing : "🎤 Voice message"
                      );
                      updateTypingStatus(true);
                    }
                    return next;
                  });
                }}
              >
                🎤
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden-file-input"
                onChange={handleFileSelected}
              />
              <input
                type="text"
                placeholder={
                  currentUserId && hasActiveChat
                    ? "Type a message..."
                    : "Select a chat or room to start"
                }
                value={newMessage}
                onChange={async (e) => {
                  const value = e.target.value;
                  setNewMessage(value);
                  await updateTypingStatus(Boolean(value.trim()));
                }}
                disabled={!currentUserId || !hasActiveChat || sending}
              />
            </div>
            <button
              type="submit"
              className="send-button bg-gradient-to-tr from-indigo-500 to-sky-500"
              disabled={
                !currentUserId ||
                !hasActiveChat ||
                sending ||
                !newMessage.trim()
              }
            >
              <span className="sr-only">Send</span>
              <span className="send-icon">➤</span>
            </button>
          </form>

          {error && <div className="error inline-error">{error}</div>}

          {showSettings && (
            <div className="settings-backdrop">
              <div className="settings-modal">
                <div className="settings-header">Settings</div>
                <div className="settings-section">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={denseMessages}
                      onChange={(e) => setDenseMessages(e.target.checked)}
                    />
                    <span>Compact message spacing</span>
                  </label>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="edit-profile-cancel"
                    onClick={() => setShowSettings(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEditProfile && (
            <div className="edit-profile-backdrop">
              <div className="edit-profile-modal">
                <div className="edit-profile-header">Edit profile</div>
                <form onSubmit={handleSaveProfile} className="edit-profile-form">
                  <label className="edit-profile-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <label className="edit-profile-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </label>
                  <div className="edit-profile-actions">
                    <button
                      type="button"
                      className="edit-profile-cancel"
                      onClick={() => setShowEditProfile(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="edit-profile-save"
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
