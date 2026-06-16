"use client";

import {
  BarVisualizer,
  VoiceAssistantControlBar,
  useVoiceAssistant,
  DisconnectButton,
  useTrackTranscription,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export function VoiceAssistant({ onLeave }: { onLeave: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();

  // Transcribe what the local user (you) is saying, so both sides show up.
  const { localParticipant } = useLocalParticipant();
  const { segments: userSegments } = useTrackTranscription({
    publication: localParticipant.getTrackPublication(Track.Source.Microphone),
    source: Track.Source.Microphone,
    participant: localParticipant,
  });

  return (
    <div className="assistant">
      <span className="state-pill">{labelForState(state)}</span>

      <div className="visualizer">
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          options={{ minHeight: 12 }}
        />
      </div>

      <VoiceAssistantControlBar />

      <div className="transcript">
        {(agentTranscriptions ?? []).map((seg) => (
          <div key={seg.id} className="transcript-line">
            <span className="speaker">Agent:</span>
            {seg.text}
          </div>
        ))}
        {(userSegments ?? []).map((seg) => (
          <div key={seg.id} className="transcript-line">
            <span className="speaker">You:</span>
            {seg.text}
          </div>
        ))}
      </div>

      <DisconnectButton className="start-button" onClick={onLeave}>
        End call
      </DisconnectButton>
    </div>
  );
}

function labelForState(state: string): string {
  switch (state) {
    case "connecting":
      return "Connecting to agent…";
    case "initializing":
      return "Waking up the agent…";
    case "listening":
      return "Listening — go ahead";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Agent is speaking";
    case "disconnected":
      return "Disconnected";
    default:
      return state;
  }
}
