import { useState, useEffect } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { Room, Participant } from "./types";

function App() {
  const [roomId, setRoomId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentVote, setCurrentVote] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [joinMode, setJoinMode] = useState<"create" | "join" | null>(null);

  const votingOptions = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55"];

  // Create a new room
  const createRoom = async () => {
    try {
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert([{ revealed: false }])
        .select()
        .single();

      if (roomError) throw roomError;

      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert([
          {
            room_id: room.id,
            name: username,
            vote: null,
          },
        ])
        .select()
        .single();

      if (participantError) throw participantError;

      setRoomId(room.id);
      setParticipantId(participant.id);
      setIsJoining(false);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to create room");
    }
  };

  // Join an existing room
  const joinRoom = async () => {
    if (!username || !roomId) return;

    try {
      // First check if room exists
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (roomError) {
        setError("Room not found");
        return;
      }

      // Then create participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert([
          {
            room_id: roomId,
            name: username,
            vote: null,
          },
        ])
        .select()
        .single();

      if (participantError) throw participantError;

      setParticipantId(participant.id);
      setIsRevealed(room.revealed);
      setIsJoining(false);
      setError(null);
    } catch (error) {
      console.error("Error joining room:", error);
      setError("Failed to join room");
    }
  };

  // Handle voting
  const handleVote = async (value: string) => {
    try {
      await supabase
        .from("participants")
        .update({ vote: value })
        .eq("id", participantId);

      setCurrentVote(value);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to submit vote");
    }
  };

  // Reveal votes
  const handleReveal = async () => {
    try {
      await supabase.from("rooms").update({ revealed: true }).eq("id", roomId);
      setIsRevealed(true);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to reveal votes");
    }
  };

  // Reset votes
  const handleReset = async () => {
    try {
      await supabase.from("rooms").update({ revealed: false }).eq("id", roomId);

      await supabase
        .from("participants")
        .update({ vote: null })
        .eq("room_id", roomId);

      setIsRevealed(false);
      setCurrentVote(null);
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to reset votes");
    }
  };

  // Setup real-time subscriptions
  useEffect(() => {
    if (!roomId || isJoining) return;

    // Create a new real-time channel
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: true },
        presence: {
          key: participantId as string,
        },
      },
    });

    // Handle room changes (reveal/reset)
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log("Room changed:", payload);
          if (payload.new) {
            setIsRevealed((payload.new as Room).revealed);
          }
        }
      )
      // Handle participant changes (join/leave/vote)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log("Participant changed:", payload);

          // Handle different events
          switch (payload.eventType) {
            case "INSERT":
              // New participant joined
              const newParticipant = payload.new as Participant;
              setParticipants((prev) => [...prev, newParticipant]);
              break;

            case "DELETE":
              // Participant left
              const oldParticipant = payload.old as Participant;
              setParticipants((prev) =>
                prev.filter((p) => p.id !== oldParticipant.id)
              );
              break;

            case "UPDATE":
              // Participant voted or changed
              const updatedParticipant = payload.new as Participant;
              setParticipants((prev) =>
                prev.map((p) =>
                  p.id === updatedParticipant.id ? updatedParticipant : p
                )
              );
              break;
          }
        }
      )
      // Handle presence state (online/offline)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("Presence state:", state);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track presence after successful subscription
          const status = await channel.track({
            user: username,
            online_at: new Date().toISOString(),
          });
          console.log("Presence tracking status:", status);
        }
      });

    setChannel(channel);

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, [roomId, participantId, isJoining, username]);

  // Handle participant leave
  const handleLeave = async () => {
    try {
      if (participantId) {
        await supabase.from("participants").delete().eq("id", participantId);
      }

      if (channel) {
        await channel.untrack();
        await channel.unsubscribe();
      }

      setIsJoining(true);
      setParticipantId(null);
      setCurrentVote(null);
      setRoomId("");
    } catch (error) {
      console.error("Error leaving room:", error);
      setError("Failed to leave room");
    }
  };

  // Fetch initial participants when joining a room
  useEffect(() => {
    if (!roomId || isJoining) return;

    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("room_id", roomId);

      if (error) {
        console.error("Error fetching participants:", error);
        return;
      }

      if (data) {
        setParticipants(data);
      }
    };

    fetchParticipants();
  }, [roomId, isJoining]);

  // Set up real-time subscription for participants
  useEffect(() => {
    if (!roomId || isJoining) return;

    // Subscribe to participant changes
    const participantsSubscription = supabase
      .channel(`room-${roomId}-participants`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("Participant change:", payload);

          if (payload.eventType === "INSERT") {
            setParticipants((prev) => [...prev, payload.new as Participant]);
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) =>
              prev.filter((p) => p.id !== payload.old.id)
            );
          } else if (payload.eventType === "UPDATE") {
            setParticipants((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? (payload.new as Participant) : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      participantsSubscription.unsubscribe();
    };
  }, [roomId, isJoining]);

  // Render participants list
  const renderParticipants = () => (
    <div className="mb-6">
      <h3 className="text-lg font-medium mb-3">Participants</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`
              p-3 rounded-lg border flex items-center justify-between
              ${
                participant.id === participantId
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-50 border-gray-200"
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-medium">
                  {participant.name[0].toUpperCase()}
                </span>
              </div>
              <span className="font-medium">
                {participant.name}
                {participant.id === participantId && " (You)"}
              </span>
            </div>
            <div>
              {isRevealed ? (
                <span
                  className={`
                  px-2 py-1 rounded-full text-sm
                  ${
                    participant.vote
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }
                `}
                >
                  {participant.vote || "No vote"}
                </span>
              ) : (
                <span
                  className={`
                  px-2 py-1 rounded-full text-sm
                  ${
                    participant.vote
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }
                `}
                >
                  {participant.vote ? "Voted" : "Thinking..."}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Separate join and create UI
  const renderJoinCreate = () => (
    <div className="space-y-6">
      {!joinMode ? (
        // Initial selection
        <div className="space-y-4">
          <button
            onClick={() => setJoinMode("create")}
            className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600"
          >
            Create New Room
          </button>
          <button
            onClick={() => setJoinMode("join")}
            className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600"
          >
            Join Existing Room
          </button>
        </div>
      ) : (
        // Join or Create form
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border rounded-lg"
              placeholder="Enter your name"
            />
          </div>

          {joinMode === "join" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full p-3 border rounded-lg"
                placeholder="Enter room ID"
              />
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => {
                if (joinMode === "create") {
                  createRoom();
                } else {
                  joinRoom();
                }
              }}
              disabled={!username || (joinMode === "join" && !roomId)}
              className={`
                flex-1 px-4 py-3 rounded-lg text-white font-medium
                ${
                  !username || (joinMode === "join" && !roomId)
                    ? "bg-gray-300 cursor-not-allowed"
                    : joinMode === "create"
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-green-500 hover:bg-green-600"
                }
              `}
            >
              {joinMode === "create" ? "Create Room" : "Join Room"}
            </button>
            <button
              onClick={() => setJoinMode(null)}
              className="px-4 py-3 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );

  // Update the UI to show real-time status
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        {isJoining ? (
          renderJoinCreate()
        ) : (
          <div className="space-y-6">
            {/* Room Header */}
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">Planning Poker</h2>
                <p className="text-sm text-gray-500">Room ID: {roomId}</p>
              </div>
              <div className="flex space-x-2">
                {!isRevealed && (
                  <button
                    onClick={handleReveal}
                    disabled={!participants.every((p) => p.vote)}
                    className={`
                      px-4 py-2 rounded-lg font-medium
                      ${
                        participants.every((p) => p.vote)
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }
                    `}
                  >
                    Reveal
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="bg-gray-100 px-4 py-2 rounded-lg font-medium hover:bg-gray-200"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Participants List */}
            {renderParticipants()}

            {/* Voting Options */}
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {["0", "1", "2", "3", "5", "8", "13", "21", "34", "55"].map(
                (value) => (
                  <button
                    key={value}
                    onClick={() => handleVote(value)}
                    className={`
                    p-4 rounded-lg border text-center font-medium
                    ${
                      currentVote === value
                        ? "bg-blue-100 border-blue-500 text-blue-700"
                        : "hover:bg-gray-50"
                    }
                  `}
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
