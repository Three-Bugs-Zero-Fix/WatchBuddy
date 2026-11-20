import React, { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors, Fonts } from '../theme';
import { auth } from '../services/firebase';
import {
  RoomData,
  subscribeToRoom,
  joinRoom,
  closeRoom,
  leaveRoom,
  updatePlayback,
  extractYouTubeVideoId,
  setupParticipantPresence,
} from '../services/rooms';
import {
  ChatMessage,
  sendChatMessage,
  subscribeToChat,
} from '../services/chat';
import YouTubePlayer from '../components/YouTubePlayer';

export default function RoomScreen() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    auth.currentUser?.uid ?? null,
  );

  // Direct invite link join state
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Host video URL input state
  const [videoUrl, setVideoUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // Side panel state (Chat & People)
  const [activeTab, setActiveTab] = useState<'chat' | 'people'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const normalizedCode = roomCode ? roomCode.toUpperCase() : '';

  // Track Firebase Anonymous Auth state across reloads
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribeAuth();
  }, []);

  // Subscribe to real-time room state
  useEffect(() => {
    if (!normalizedCode) {
      navigate('/');
      return;
    }

    const unsubscribeRoom = subscribeToRoom(normalizedCode, data => {
      setRoom(data);
      setLoading(false);
    });

    return () => unsubscribeRoom();
  }, [normalizedCode, navigate]);

  // Subscribe to real-time chat messages under /roomChats/{roomCode}
  useEffect(() => {
    if (!normalizedCode) return;
    const unsubscribeChat = subscribeToChat(normalizedCode, setMessages);
    return () => unsubscribeChat();
  }, [normalizedCode]);

  const currentParticipant =
    room && currentUserId ? room.participants?.[currentUserId] : undefined;
  const isParticipant = Boolean(currentParticipant);
  const isHost = Boolean(
    room && currentUserId && room.hostId === currentUserId,
  );

  // Ensure disconnect cleanup is active whenever the participant is in the room
  useEffect(() => {
    if (normalizedCode && currentUserId && isParticipant) {
      setupParticipantPresence(normalizedCode, currentUserId);
    }
  }, [normalizedCode, currentUserId, isParticipant]);

  const handleDirectJoin = async () => {
    if (!guestName.trim()) {
      setJoinError('Please enter your name to join.');
      return;
    }

    try {
      setJoining(true);
      setJoinError('');
      await joinRoom(normalizedCode, guestName);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : 'Failed to join room.',
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLoadVideo = async () => {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      setUrlError('Please paste a valid YouTube video link.');
      return;
    }

    setUrlError('');
    await updatePlayback(normalizedCode, {
      videoId,
      isPlaying: true,
      currentTime: 0,
    });
    setVideoUrl('');
  };

  const handleHostSync = async (isPlaying: boolean, currentTime: number) => {
    if (!isHost || !normalizedCode) return;
    await updatePlayback(normalizedCode, { isPlaying, currentTime });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentUserId || !currentParticipant) return;
    const textToSend = chatInput;
    setChatInput('');
    await sendChatMessage(
      normalizedCode,
      currentUserId,
      currentParticipant.name,
      textToSend,
    );
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/room/${normalizedCode}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to leave this room?',
    );
    if (!confirmed) return;

    if (normalizedCode && currentUserId) {
      await leaveRoom(normalizedCode, currentUserId);
    }
    navigate('/');
  };

  const handleCloseRoom = async () => {
    const confirmed = window.confirm(
      'Close this room for everyone? All participants will be disconnected.',
    );
    if (!confirmed) return;

    if (normalizedCode) {
      await closeRoom(normalizedCode);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading room...</Text>
      </View>
    );
  }

  if (!room || room.status === 'closed') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          {!room ? 'Room not found.' : 'This room has been closed by the host.'}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigate('/')}>
          <Text style={styles.btnText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  // Prompt guest for display name if they arrived directly via invite link
  if (!isParticipant) {
    return (
      <View style={styles.center}>
        <View style={styles.joinCard}>
          <Text style={styles.title}>Join Room {normalizedCode}</Text>
          <Text style={styles.subtext}>Hosted by {room.hostName}</Text>

          <TextInput
            value={guestName}
            onChangeText={value => {
              setGuestName(value);
              if (joinError) setJoinError('');
            }}
            placeholder="Enter your display name"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
            maxLength={24}
            editable={!joining}
          />

          {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, joining && styles.btnDisabled]}
            onPress={handleDirectJoin}
            disabled={joining}
          >
            <Text style={styles.btnText}>
              {joining ? 'Joining...' : 'Join Room'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const participantsList = Object.entries(room.participants || {});

  return (
    <View style={styles.page}>
      {/* Top navigation bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>W</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>WatchBuddy</Text>
            <Text style={styles.subtext}>
              Room: {normalizedCode} · Host: {room.hostName}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryBtn} onPress={handleCopyLink}>
            <Text style={styles.btnText}>
              {copied ? 'Link Copied!' : 'Copy Invite Link'}
            </Text>
          </Pressable>

          {isHost ? (
            <Pressable style={styles.dangerBtn} onPress={handleCloseRoom}>
              <Text style={styles.btnText}>Close Room</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.dangerBtn} onPress={handleLeaveRoom}>
              <Text style={styles.btnText}>Leave</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main watch area + side chat panel */}
      <View
        style={[
          styles.mainBody,
          isWide ? styles.mainBodyWide : styles.mainBodyNarrow,
        ]}
      >
        {/* Left column: URL input (host) + YouTube player */}
        <View style={styles.videoColumn}>
          {isHost && (
            <View style={styles.urlBarContainer}>
              <View style={styles.urlBar}>
                <TextInput
                  value={videoUrl}
                  onChangeText={value => {
                    setVideoUrl(value);
                    if (urlError) setUrlError('');
                  }}
                  placeholder="Paste YouTube video link here..."
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.urlInput}
                  onSubmitEditing={handleLoadVideo}
                />
                <Pressable style={styles.primaryBtn} onPress={handleLoadVideo}>
                  <Text style={styles.btnText}>Play</Text>
                </Pressable>
              </View>
              {urlError ? (
                <Text style={styles.errorText}>{urlError}</Text>
              ) : null}
            </View>
          )}

          <YouTubePlayer
            playback={room.playback}
            isHost={isHost}
            onHostSync={handleHostSync}
          />
        </View>

        {/* Right column: Chat & People panel */}
        <View style={[styles.sidePanel, !isWide && styles.sidePanelNarrow]}>
          {/* Panel tabs */}
          <View style={styles.tabRow}>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === 'chat' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={styles.tabText}>Chat</Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === 'people' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('people')}
            >
              <Text style={styles.tabText}>
                People ({participantsList.length})
              </Text>
            </Pressable>
          </View>

          {activeTab === 'chat' ? (
            <View style={styles.chatContainer}>
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatMessages}
                contentContainerStyle={styles.chatMessagesContent}
                onContentSizeChange={() =>
                  chatScrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.length === 0 ? (
                  <Text style={styles.emptyChatText}>
                    No messages yet. Say hello!
                  </Text>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.senderId === currentUserId;
                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageBubble,
                          isMe && styles.messageBubbleMe,
                        ]}
                      >
                        <Text style={styles.messageSender}>
                          {msg.senderName}
                        </Text>
                        <Text style={styles.messageText}>{msg.text}</Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.chatInputRow}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Enter a message..."
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.chatInput}
                  onSubmitEditing={handleSendMessage}
                />
                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleSendMessage}
                >
                  <Text style={styles.btnText}>Send</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.peopleList}
              contentContainerStyle={styles.peopleListContent}
            >
              {participantsList.map(([uid, participant]) => (
                <View key={uid} style={styles.participantRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.text}>
                    {participant.name} {participant.isHost ? '(Host)' : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
    minHeight: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },
  brandTitle: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mainBody: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  mainBodyWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mainBodyNarrow: {
    flexDirection: 'column',
  },
  videoColumn: {
    flex: 2.3,
    gap: 14,
  },
  urlBarContainer: {
    gap: 6,
  },
  urlBar: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sidePanel: {
    flex: 1,
    minWidth: 300,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sidePanelNarrow: {
    minHeight: 400,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.secondary,
  },
  tabText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  chatMessages: {
    flex: 1,
    maxHeight: 460,
  },
  chatMessagesContent: {
    padding: 14,
    gap: 10,
  },
  emptyChatText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  messageBubble: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  messageBubbleMe: {
    backgroundColor: Colors.secondary,
    alignSelf: 'flex-end',
  },
  messageSender: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  messageText: {
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  peopleList: {
    flex: 1,
  },
  peopleListContent: {
    padding: 16,
    gap: 12,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  joinCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  input: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: Colors.accent,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
  },
  subtext: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  text: {
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 13,
    fontWeight: '700',
  },
});