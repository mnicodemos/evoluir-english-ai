import { Instagram, Mail } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";
import { BrandName } from "@/components/BrandName";
import { cn } from "@/lib/utils";
import { landingCopy, type LandingLang } from "@/lib/landingCopy";

function TikTokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function ThreadsIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
    </svg>
  );
}

function XIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.672l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com/evoluirmaisenglishai", icon: Instagram },
  { label: "TikTok", href: "https://tiktok.com/@evoluirmaisenglishai", icon: TikTokIcon },
  { label: "Threads", href: "https://threads.net/@evoluirmaisenglishai", icon: ThreadsIcon },
  { label: "X", href: "https://x.com/evoluirmaisai", icon: XIcon },
];

export function Footer({
  lang = "en",
  minimal = false,
  containerClassName,
  leftAligned = false,
}: {
  lang?: LandingLang;
  minimal?: boolean;
  containerClassName?: string;
  leftAligned?: boolean;
}) {
  const t = landingCopy[lang].footer;

  const containerBase = leftAligned
    ? "max-w-6xl pl-5 pr-5 lg:pl-12 lg:pr-5 mx-0"
    : "mx-auto max-w-6xl px-5";

  if (minimal) {
    return (
      <footer className="bg-background text-foreground dark:bg-[#0B0B0C] dark:text-[#E4E4E7]">
        <div className="border-t border-border dark:border-white/10">
          <div
            className={cn(
              "flex max-w-6xl flex-col gap-3 py-5 text-xs text-muted-foreground dark:text-[#A1A1AA]",
              leftAligned
                ? "items-start justify-start sm:flex-row sm:items-start"
                : "items-center justify-between sm:flex-row",
              containerBase,
              containerClassName,
            )}
          >
            <p>{t.rights}</p>
            <div className="flex items-center gap-5">
              <a href="#" className="transition-colors hover:text-foreground dark:hover:text-white">
                {t.terms}
              </a>
              <a href="#" className="transition-colors hover:text-foreground dark:hover:text-white">
                {t.privacy}
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-background text-foreground dark:bg-[#0B0B0C] dark:text-[#E4E4E7]">
      <div className={cn(containerBase, "py-16", containerClassName)}>
        <div className="flex flex-col items-start gap-8">
          {/* Brand & Social */}
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <Logo className="size-8 shrink-0" />
              <BrandName className="text-lg text-foreground dark:text-white" />
            </div>
            <p className="max-w-[320px] text-sm font-semibold italic leading-snug text-foreground dark:text-white sm:max-w-none sm:text-base sm:leading-relaxed">
              {t.tagline}
              <br />
              {t.taglineLine2}
            </p>
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <Tooltip key={social.label}>
                    <TooltipTrigger asChild>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="grid size-10 place-items-center rounded-full border border-border bg-secondary text-foreground transition-all duration-200 hover:scale-105 hover:border-foreground/20 hover:bg-accent dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                      >
                        <social.icon className="size-5" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {social.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <a
                href="mailto:evoluirmaisoficial@hotmail.com"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground dark:text-[#A1A1AA] dark:hover:text-white"
              >
                <Mail className="size-4" aria-hidden="true" />
                <span>evoluirmaisoficial@hotmail.com</span>
              </a>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border dark:border-white/10">
        <div
          className={cn(
            "flex max-w-6xl flex-col gap-3 py-5 text-xs text-muted-foreground dark:text-[#A1A1AA]",
            leftAligned
              ? "items-start justify-start sm:flex-row sm:items-start"
              : "items-center justify-between sm:flex-row",
            containerBase,
            containerClassName,
          )}
        >
          <p>{t.rights}</p>
          <div className="flex items-center gap-5">
            <a href="#" className="transition-colors hover:text-foreground dark:hover:text-white">
              {t.terms}
            </a>
            <a href="#" className="transition-colors hover:text-foreground dark:hover:text-white">
              {t.privacy}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
