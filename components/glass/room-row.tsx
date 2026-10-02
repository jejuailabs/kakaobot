"use client";

import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/glass/glass-card";
import { roomStateTone } from "@/features/bots/status";
import { Link } from "@/i18n/navigation";
import type { Room } from "@/lib/shared/domain";
import { cn } from "@/lib/shared/cn";
import { useRelativeTime } from "@/components/ui/use-relative-time";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#a6e9ff,#bdafff)",
  "linear-gradient(135deg,#ffd9b0,#ff9baf)",
  "linear-gradient(135deg,#77e7c1,#a6e9ff)",
  "linear-gradient(135deg,#bdafff,#ffd98a)",
];

export function Avatar({ label, seed, size = 32 }: { label: string; seed: string; size?: number }) {
  const idx = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#0b2b40]"
      style={{ width: size, height: size, background: AVATAR_GRADIENTS[idx] }}
      aria-hidden
    >
      {label.slice(0, 1)}
    </span>
  );
}

export function RoomRow({ room, botName, href, className }: { room: Room; botName: string; href?: string; className?: string }) {
  const t = useTranslations();
  const rel = useRelativeTime();
  const content = (
    <>
      <Avatar label={room.label} seed={room.id} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{room.label}</p>
        <p className="truncate text-caption text-muted">
          {botName}
          {" · "}
          {room.lastMessageAt ? rel(room.lastMessageAt) : t("rooms.noMessages")}
        </p>
      </div>
      <StatusPill tone={roomStateTone[room.state]}>{t(`status.room.${room.state}`)}</StatusPill>
    </>
  );
  const cls = cn("flex min-h-14 items-center gap-3 rounded-[12px] px-2 py-2", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]")}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
