import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
  RoomConfiguration,
  RoomAgentDispatch,
} from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import type { AgentConfig } from "@/app/lib/agentConfig";

// Don't cache — every request mints a fresh token.
export const revalidate = 0;

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// The browser POSTs the agent config; it travels in the dispatch metadata and
// the Python agent reads it to build the session.
export async function POST(req: NextRequest) {
  try {
    if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
      throw new Error(
        "Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET or LIVEKIT_URL in .env.local",
      );
    }

    let config: AgentConfig | undefined;
    try {
      const body = await req.json();
      config = body?.config;
    } catch {
      // no body — agent will use its built-in defaults
    }

    // A unique room + participant per session so demos don't collide.
    const participantIdentity = `user-${Math.floor(Math.random() * 10_000)}`;
    const roomName = `demo-room-${Math.floor(Math.random() * 10_000)}`;

    const token = await createParticipantToken(
      { identity: participantIdentity },
      roomName,
      config,
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName: participantIdentity,
      participantToken: token,
    };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  config?: AgentConfig,
) {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: "15m",
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  // EXPLICIT DISPATCH: dispatch the named agent and pass the config as metadata.
  // The agent reads ctx.job.metadata and builds its session from it.
  //
  // We also set the same config as the ROOM metadata, so it shows up in the
  // LiveKit Cloud "Sessions" view for this call — making each call's config
  // observable inside LiveKit.
  const configJson = config ? JSON.stringify(config) : "";
  if (AGENT_NAME) {
    at.roomConfig = new RoomConfiguration({
      metadata: configJson,
      agents: [
        new RoomAgentDispatch({
          agentName: AGENT_NAME,
          metadata: configJson,
        }),
      ],
    });
  }

  return at.toJwt();
}
