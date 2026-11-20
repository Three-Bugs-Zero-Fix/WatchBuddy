import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  Unsubscribe,
} from 'firebase/database';
import { db, ensureAnonymousAuth } from './firebase';

export interface Participant {
  name: string;
  joinedAt: number;
  isHost: boolean;
  isOnline: boolean;
}

export interface PlaybackState {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
}

export interface RoomData {
  hostId: string;
  hostName: string;
  createdAt: number;
  status: 'active' | 'closed';
  participants?: Record<string, Participant>;
  playback: PlaybackState;
}

/**
 * Extracts the 11-character YouTube video ID from standard, short, embed, or shorts URLs.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  // Allow pasting a raw 11-character video ID directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Generates a random 6-character uppercase alphanumeric room code.
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates a unique room code that does not already exist in RTDB.
 */
async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const snapshot = await get(ref(db, `rooms/${code}`));
    if (!snapshot.exists()) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique room code. Please try again.');
}

/**
 * Automatically removes the participant from the room if they disconnect or close the tab.
 */
export function setupParticipantPresence(
  roomCode: string,
  userId: string,
): void {
  const participantRef = ref(db, `rooms/${roomCode}/participants/${userId}`);
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, snapshot => {
    if (snapshot.val() === true) {
      // Remove participant completely on disconnect instead of showing offline
      onDisconnect(participantRef).remove();
    }
  });
}

/**
 * Creates a new room in RTDB and sets the creator as host.
 */
export async function createRoom(hostName: string): Promise<{
  roomCode: string;
  shareLink: string;
  userId: string;
}> {
  const user = await ensureAnonymousAuth();
  const roomCode = await generateUniqueRoomCode();
  const now = Date.now();

  const roomData: RoomData = {
    hostId: user.uid,
    hostName: hostName.trim(),
    createdAt: now,
    status: 'active',
    participants: {
      [user.uid]: {
        name: hostName.trim(),
        joinedAt: now,
        isHost: true,
        isOnline: true,
      },
    },
    playback: {
      videoId: '',
      isPlaying: false,
      currentTime: 0,
      updatedAt: now,
    },
  };

  await set(ref(db, `rooms/${roomCode}`), roomData);
  setupParticipantPresence(roomCode, user.uid);

  const shareLink = `${window.location.origin}/room/${roomCode}`;
  return { roomCode, shareLink, userId: user.uid };
}

/**
 * Validates that the room exists and is active, then adds the guest to participants.
 */
export async function joinRoom(
  rawRoomCode: string,
  guestName: string,
): Promise<{ roomCode: string; userId: string }> {
  const roomCode = rawRoomCode.trim().toUpperCase();
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    throw new Error('Room not found. Please check the room code.');
  }

  const roomData = snapshot.val() as RoomData;
  if (roomData.status !== 'active') {
    throw new Error('This room has already been closed by the host.');
  }

  const user = await ensureAnonymousAuth();
  const isHost = roomData.hostId === user.uid;

  const participant: Participant = {
    name: guestName.trim(),
    joinedAt: Date.now(),
    isHost,
    isOnline: true,
  };

  await set(ref(db, `rooms/${roomCode}/participants/${user.uid}`), participant);
  setupParticipantPresence(roomCode, user.uid);

  return { roomCode, userId: user.uid };
}

/**
 * Subscribes to real-time updates for a specific room.
 */
export function subscribeToRoom(
  roomCode: string,
  onUpdate: (room: RoomData | null) => void,
): Unsubscribe {
  const roomRef = ref(db, `rooms/${roomCode}`);
  return onValue(roomRef, snapshot => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as RoomData);
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Updates the room's video playback state in RTDB (host only).
 */
export async function updatePlayback(
  roomCode: string,
  playback: Partial<PlaybackState>,
): Promise<void> {
  await update(ref(db, `rooms/${roomCode}/playback`), {
    ...playback,
    updatedAt: Date.now(),
  });
}

/**
 * Closes the room for all participants (host only).
 */
export async function closeRoom(roomCode: string): Promise<void> {
  await update(ref(db, `rooms/${roomCode}`), {
    status: 'closed',
  });
}

/**
 * Removes a participant from the room when they manually leave.
 */
export async function leaveRoom(
  roomCode: string,
  userId: string,
): Promise<void> {
  await remove(ref(db, `rooms/${roomCode}/participants/${userId}`));
}