import { ref, push, set, onValue, Unsubscribe } from 'firebase/database';
import { db } from './firebase';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

/**
 * Sends a new chat message to /roomChats/{roomCode}.
 */
export async function sendChatMessage(
  roomCode: string,
  senderId: string,
  senderName: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const messagesRef = ref(db, `roomChats/${roomCode}`);
  const newMessageRef = push(messagesRef);

  await set(newMessageRef, {
    senderId,
    senderName,
    text: trimmed,
    createdAt: Date.now(),
  });
}

/**
 * Subscribes to real-time chat messages for a specific room.
 */
export function subscribeToChat(
  roomCode: string,
  onUpdate: (messages: ChatMessage[]) => void,
): Unsubscribe {
  const messagesRef = ref(db, `roomChats/${roomCode}`);

  return onValue(messagesRef, snapshot => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const raw = snapshot.val() as Record<string, Omit<ChatMessage, 'id'>>;
    const list: ChatMessage[] = Object.entries(raw)
      .map(([id, msg]) => ({ id, ...msg }))
      .sort((a, b) => a.createdAt - b.createdAt);

    onUpdate(list);
  });
}