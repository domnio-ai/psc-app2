export type LiveConferenceSession = {
  sessionId: string;
  provider: string;
  providerBaseUrl: string;
  deploymentMode: "private-self-hosted";
  roomCode: string;
  joinUrl: string;
  status: "Ready" | "Live" | "Ended";
  startedAt: string | null;
  endedAt: string | null;
  isHost: boolean;
};

export type LivePresence = {
  user_id: string;
  name: string;
  role: string;
  joined_at: string;
  left_at: string | null;
  last_seen_at: string;
  active: boolean;
};

export type ConferenceProviderStatus = {
  configured: boolean;
  reachable: boolean;
  deploymentMode: "private-self-hosted";
  provider: "jitsi-self-hosted";
  providerBaseUrl: string | null;
  message: string;
};
