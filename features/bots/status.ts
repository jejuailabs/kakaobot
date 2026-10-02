import type { PillTone } from "@/components/glass/glass-card";
import type { BotState, GatewayHealth, JoinRequestState, RoomState } from "@/lib/shared/domain";

export const botStateTone: Record<BotState, PillTone> = {
  draft: "neutral",
  awaiting_join: "warning",
  awaiting_code: "info",
  active: "success",
  paused: "neutral",
};

export const roomStateTone: Record<RoomState, PillTone> = {
  connected: "success",
  paused: "neutral",
};

export const joinStateTone: Record<JoinRequestState, PillTone> = {
  pending: "warning",
  awaiting_code: "info",
  rejected: "danger",
  connected: "success",
};

export const gatewayTone: Record<GatewayHealth, PillTone> = {
  online: "success",
  degraded: "warning",
  offline: "danger",
  unknown: "neutral",
};
