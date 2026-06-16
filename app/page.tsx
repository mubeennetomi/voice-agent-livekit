"use client";

import { useCallback, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import type { ConnectionDetails } from "./api/connection-details/route";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { CallSummary } from "./components/CallSummary";
import { ConfigForm } from "./components/ConfigForm";
import { type AgentConfig, defaultAgentConfig } from "./lib/agentConfig";

export default function Page() {
  const [connectionDetails, setConnectionDetails] =
    useState<ConnectionDetails | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endedRoom, setEndedRoom] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig>(defaultAgentConfig);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setEndedRoom(null);
    try {
      const res = await fetch("/api/connection-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get token");
      setConnectionDetails(data as ConnectionDetails);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setConnecting(false);
    }
  }, [config]);

  const handleDisconnected = useCallback(() => {
    setConnectionDetails((current) => {
      if (current) setEndedRoom(current.roomName);
      return null;
    });
  }, []);

  // In a call.
  if (connectionDetails) {
    return (
      <main className="page">
        <LiveKitRoom
          token={connectionDetails.participantToken}
          serverUrl={connectionDetails.serverUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleDisconnected}
          onError={(e) => setError(e.message)}
        >
          <VoiceAssistant onLeave={handleDisconnected} />
          {/* Plays all audio tracks coming from the room (i.e. the agent). */}
          <RoomAudioRenderer />
        </LiveKitRoom>
      </main>
    );
  }

  // Call just ended — show metrics fetched from the server.
  if (endedRoom) {
    return (
      <main className="page">
        <CallSummary room={endedRoom} onRestart={connect} />
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  // Initial screen — configure the agent, then start.
  return (
    <main className="page page-wide">
      <h1 className="title">🎙️ LiveKit Voice Agent Demo</h1>
      <p className="subtitle">
        Configure the agent below, then start a live call. Your microphone will
        be used, so allow access when prompted.
      </p>
      <ConfigForm
        config={config}
        onChange={setConfig}
        onStart={connect}
        connecting={connecting}
      />
      {error && <p className="error">{error}</p>}
    </main>
  );
}
