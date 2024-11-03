export type VotingSystem = "fibonacci" | "linear" | "tshirt";

export interface Room {
  id: string;
  name: string;
  voting_system: VotingSystem;
  revealed: boolean;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  name: string;
  vote: string | null;
  created_at: string;
}
