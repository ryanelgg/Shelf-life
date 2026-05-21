export type AvoChatMessage = { role: 'user' | 'assistant'; content: string };

export interface AvoDisplayMessage {
  id: string;
  role: 'avo' | 'user';
  text: string;
  streaming?: boolean;
}

const INTRO_MESSAGE: AvoDisplayMessage = {
  id: 'intro',
  role: 'avo',
  text: "Hey! I'm Avo, your personal nutrition guide. Ask me anything about food, nutrients, or what to eat for your goals. I can even work with what's in your pantry!",
};

let currentOwnerId: string | null = null;
let persistedMessages: AvoDisplayMessage[] = [INTRO_MESSAGE];
let persistedHistory: AvoChatMessage[] = [];

function resetForOwner(ownerId: string | null) {
  currentOwnerId = ownerId;
  persistedMessages = [INTRO_MESSAGE];
  persistedHistory = [];
}

export function getAvoSession(ownerId: string | null) {
  if (currentOwnerId !== ownerId) {
    resetForOwner(ownerId);
  }

  return {
    messages: persistedMessages,
    history: persistedHistory,
  };
}

export function setAvoSessionMessages(messages: AvoDisplayMessage[]) {
  persistedMessages = messages;
}

export function setAvoSessionHistory(history: AvoChatMessage[]) {
  persistedHistory = history;
}

export function resetAvoChatSession() {
  resetForOwner(null);
}
