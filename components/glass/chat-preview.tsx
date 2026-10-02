import { ChevronLeft, Menu, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/shared/cn";

export type ChatLine = { from: "user" | "bot"; text: string; name?: string };

/**
 * 제품 자체 mock 채팅 (216×432 비율). 카카오 yellow 는 사용자 말풍선에만 사용한다.
 * 실제 카카오톡 화면 캡처가 아니다.
 */
export function ChatPreview({
  title,
  subtitle,
  lines,
  inputPlaceholder,
  className,
  time = "9:41",
}: {
  title: string;
  subtitle: string;
  lines: ChatLine[];
  inputPlaceholder: string;
  className?: string;
  time?: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel relative flex aspect-[216/432] w-full flex-col overflow-hidden rounded-[30px] p-2.5 shadow-2xl",
        className,
      )}
      role="img"
      aria-label={`${title} — ${subtitle}`}
    >
      <div className="flex items-center justify-between px-3 pt-1 text-[11px] font-semibold" aria-hidden>
        <span className="tabular">{time}</span>
        <span className="h-4 w-14 rounded-full bg-[color-mix(in_srgb,var(--text)_85%,transparent)]" />
        <span className="flex gap-0.5">
          <span className="h-2 w-1 rounded-sm bg-current" />
          <span className="h-2 w-1 rounded-sm bg-current opacity-70" />
          <span className="h-2 w-3 rounded-sm bg-current" />
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 border-b border-glass-border px-2 pb-2" aria-hidden>
        <ChevronLeft className="size-4 text-muted" />
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-primary-fg">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-semibold">{title}</p>
          <p className="truncate text-[10px] text-success">{subtitle}</p>
        </div>
        <Menu className="size-4 text-muted" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-1.5 py-2" aria-hidden>
        {lines.map((l, i) =>
          l.from === "user" ? (
            <p key={i} className="ml-auto max-w-[82%] rounded-[14px] rounded-tr-[4px] bg-kakao px-2.5 py-1.5 text-[11px] leading-[16px] text-kakao-fg">
              {l.text}
            </p>
          ) : (
            <div key={i} className="max-w-[88%]">
              {l.name && <p className="mb-0.5 text-[10px] text-muted">{l.name}</p>}
              <p className="glass-solid rounded-[14px] rounded-tl-[4px] px-2.5 py-1.5 text-[11px] leading-[16px] text-fg">{l.text}</p>
            </div>
          ),
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-glass-border bg-input px-3 py-1.5" aria-hidden>
        <span className="flex-1 truncate text-[10px] text-muted">{inputPlaceholder}</span>
        <Send className="size-3.5 text-muted" />
      </div>
    </div>
  );
}
