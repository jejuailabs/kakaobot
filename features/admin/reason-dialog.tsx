"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, GlassTextarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/primitives";

/** 감사 기록이 남는 운영 작업: 사유 입력 필수 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "primary",
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  tone?: "primary" | "danger";
  children?: React.ReactNode;
}) {
  const t = useTranslations();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const invalid = reason.trim().length < 4;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) {
          setReason("");
          setTouched(false);
        }
        onOpenChange(o);
      }}
      title={title}
      description={description}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              setBusy(true);
              await onConfirm(reason.trim());
              setBusy(false);
              setReason("");
              setTouched(false);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        <Field id="audit-reason" label={t("admin.reason")} hint={t("admin.reasonHint")} error={touched && invalid ? t("admin.reasonRequired") : null}>
          {(p) => <GlassTextarea {...p} className="min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
