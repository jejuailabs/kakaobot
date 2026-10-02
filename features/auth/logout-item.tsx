"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { MenuItem } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import { firebaseAuth, sessionRequest } from "@/lib/client/firebase";

/** 로그아웃: 서버 session cookie 제거 + 브라우저 Firebase signOut */
export function LogoutItem({ label }: { label: string }) {
  const router = useRouter();
  return (
    <MenuItem
      onSelect={async () => {
        await sessionRequest("DELETE").catch(() => null);
        await signOut(firebaseAuth()).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4 text-muted" aria-hidden />
      {label}
    </MenuItem>
  );
}
