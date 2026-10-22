import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { emailShareUrl, whatsappShareUrl } from "@/lib/share";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

const ghostClass = "h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground";

function useT() {
  const { lang } = useUiLang();
  return (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
}

/** Copies the text and shows "Copied" with a check for 2 s. */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(ghostClass, className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(t("The text could not be copied."));
        }
      }}
    >
      {copied ? (
        <Check className="text-brand-green" aria-hidden="true" />
      ) : (
        <Copy aria-hidden="true" />
      )}
      {copied ? t("Copied") : t("Copy")}
    </Button>
  );
}

/** Opens WhatsApp (app on phones, WhatsApp Web or Desktop on computers) with the text. */
export function WhatsAppButton({
  text,
  label,
  className,
}: {
  text: string;
  /** Visible label in English (translated here); "WhatsApp" when left out. */
  label?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <Button asChild variant="ghost" size="sm" className={cn(ghostClass, className)}>
      <a
        href={whatsappShareUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t(label ?? "Send on WhatsApp")}
      >
        <MessageCircle className="text-[#25D366]" aria-hidden="true" />
        {label ? t(label) : "WhatsApp"}
      </a>
    </Button>
  );
}

/** Opens the student's email app with the subject and text filled in. */
export function EmailButton({
  subject,
  text,
  className,
}: {
  subject: string;
  text: string;
  className?: string;
}) {
  const t = useT();
  return (
    <Button asChild variant="ghost" size="sm" className={cn(ghostClass, className)}>
      <a href={emailShareUrl(subject, text)} aria-label={t("Send by email")}>
        <Mail aria-hidden="true" />
        {t("Email")}
      </a>
    </Button>
  );
}
