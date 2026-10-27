import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Copy, Loader2, MessageCircle, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AdminPanelButton } from "@/components/AdminPanelButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";
import { profileIsPremium } from "@/lib/billing/subscriptionView";
import {
  createWhatsAppStudyLinkCode,
  getWhatsAppStudyConnectionStatus,
} from "@/lib/whatsapp.functions";

/**
 * WhatsApp study integration (Cloud API) — the whole implementation stays in
 * place; only this section's display is hidden from students until the Meta
 * setup is validated (WHATSAPP_STUDY_ENABLED stays off). Flip to true to show
 * it again.
 */
const WHATSAPP_SECTION_VISIBLE = false;

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function translate(label: string, lang: "en" | "pt") {
  return lang === "pt" ? (uiPt[label] ?? label) : label;
}

function initials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.split("@")[0] || "User").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (source[1] ?? "");
  const letters = `${first}${second}`;
  return letters.toUpperCase();
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// The photo's signed link lasts a day and is kept in the browser, so a page
// change or a reload shows the same, already cached image at once instead of
// asking Storage for a new link (a new link means a new download and a blink;
// user report). It is renewed an hour before it expires.
const AVATAR_LINK_SECONDS = 24 * 60 * 60;
const AVATAR_RENEW_MS = 60 * 60 * 1000;
const AVATAR_STORE_KEY = "evoluir-avatar-link";

type StoredAvatarLink = { path: string; url: string; expiresAt: number };

function readStoredAvatarLink(): StoredAvatarLink | null {
  try {
    const raw = window.localStorage.getItem(AVATAR_STORE_KEY);
    const link = raw ? (JSON.parse(raw) as StoredAvatarLink) : null;
    return link && link.expiresAt - AVATAR_RENEW_MS > Date.now() ? link : null;
  } catch {
    return null;
  }
}

function storeAvatarLink(link: StoredAvatarLink) {
  try {
    window.localStorage.setItem(AVATAR_STORE_KEY, JSON.stringify(link));
  } catch {
    // Private mode or blocked storage: the photo still loads, only not cached.
  }
}

function useAvatarUrl(path?: string | null) {
  // Read after mount, so the server's HTML and the first client render agree.
  const [stored, setStored] = useState<StoredAvatarLink | null>(null);
  useEffect(() => setStored(readStoredAvatarLink()), []);
  const query = useQuery<string | null>({
    queryKey: ["avatar-url", path],
    enabled: !!path,
    staleTime: AVATAR_LINK_SECONDS * 1000 - AVATAR_RENEW_MS,
    refetchOnWindowFocus: false,
    // A stored link for this same photo shows it at once, aged by when it was made.
    initialData: () => (stored?.path === path ? stored?.url : undefined),
    initialDataUpdatedAt: () =>
      stored?.path === path && stored ? stored.expiresAt - AVATAR_LINK_SECONDS * 1000 : undefined,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, AVATAR_LINK_SECONDS);
      if (error) throw error;
      storeAvatarLink({
        path,
        url: data.signedUrl,
        expiresAt: Date.now() + AVATAR_LINK_SECONDS * 1000,
      });
      return data.signedUrl;
    },
  });
  // While the profile is still loading, the last photo already shows.
  return { data: query.data ?? (path === undefined ? stored?.url : undefined) };
}

/**
 * The round photo with the initials underneath. A plain image over the
 * initials, not Radix's Avatar: that one shows the initials until the image
 * fires its load event again on every mount, so the photo blinked on each page
 * change even when the browser already had it (user report).
 */
function ProfilePhoto({
  src,
  alt,
  className,
  fallbackClassName,
  children,
}: {
  src?: string | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  children: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-full items-center justify-center rounded-full bg-accent font-bold text-accent-foreground",
          fallbackClassName,
        )}
      >
        {children}
      </span>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}

export function ProfileMenu({
  className,
  presentation = "icon",
  toolbar,
}: {
  className?: string;
  presentation?: "icon" | "dashboard-sidebar" | "mobile-menu";
  /** Desktop sidebar and phone menu: the icon buttons beside the gear in the profile card. */
  toolbar?: ReactNode;
}) {
  const gearRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const { lang } = useUiLang();
  const { data: profile } = useProfile();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 13_000);
  };
  useEffect(() => {
    if (!open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
      return;
    }
    resetCloseTimer();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
    };
  }, [open]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [whatsAppCode, setWhatsAppCode] = useState<string | null>(null);
  const [whatsAppCodeExpiresAt, setWhatsAppCodeExpiresAt] = useState<string | null>(null);
  const [whatsAppCodeCopied, setWhatsAppCodeCopied] = useState(false);

  const whatsAppStatus = useQuery({
    queryKey: ["whatsapp-study-connection", profile?.id],
    enabled: WHATSAPP_SECTION_VISIBLE && open && !!profile?.id,
    queryFn: () => getWhatsAppStudyConnectionStatus({ data: {} }),
    retry: false,
  });

  const createWhatsAppCode = useMutation({
    mutationFn: () => createWhatsAppStudyLinkCode({ data: {} }),
    onSuccess: (result) => {
      setWhatsAppCode(result.code);
      setWhatsAppCodeExpiresAt(result.expiresAt);
      setWhatsAppCodeCopied(false);
      toast.success(translate("WhatsApp connection", lang));
    },
    onError: () => {
      toast.error(translate("Could not generate a connection code. Please try again.", lang));
    },
  });

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setPhone(maskPhone(profile?.phone ?? ""));
    setBio(profile?.bio ?? "");
    setAvatarFile(null);
    setWhatsAppCode(null);
    setWhatsAppCodeExpiresAt(null);
    setWhatsAppCodeCopied(false);
  }, [open, profile]);

  const avatarPreview = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(translate("Choose an image file.", lang));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(translate("Choose a photo up to 5 MB.", lang));
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) throw new Error("Please sign in again.");

      let avatarPath = profile?.avatar_path ?? null;
      if (avatarFile) {
        const path = `${user.id}/profile-${Date.now()}.${extensionFor(avatarFile)}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        avatarPath = path;
      }

      const fallbackName = user.email?.split("@")[0] ?? "";
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || fallbackName,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          avatar_path: avatarPath,
        })
        .eq("id", user.id);
      if (error) throw error;
      return avatarPath;
    },
    onSuccess: (avatarPath) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (avatarPath) queryClient.invalidateQueries({ queryKey: ["avatar-url", avatarPath] });
      setOpen(false);
      setAvatarFile(null);
      toast.success(translate("Profile updated", lang));
    },
    onError: () => toast.error(translate("Could not save your profile. Please try again.", lang)),
  });

  const displayName = profile?.name || profile?.email || "User";
  const photo = avatarPreview ?? avatarUrl ?? undefined;

  // Desktop sidebar and phone menu share one profile card (user request).
  const inCard = presentation !== "icon";

  // The button that opens the profile (the card's top row, or an icon).
  const triggerButton = (
    <Button
      variant="ghost"
      size={presentation === "icon" ? "icon" : "default"}
      aria-label={translate("Edit profile", lang)}
      className={cn(
        inCard
          ? "h-auto w-full justify-start gap-3 rounded-lg px-1.5 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent/60"
          : "size-10 rounded-lg p-0 text-sidebar-foreground/70",
        className,
      )}
    >
      <ProfilePhoto
        src={photo}
        alt={displayName}
        className={inCard ? "size-10" : "size-8"}
        fallbackClassName="text-[11px]"
      >
        {profile ? initials(profile.name, profile.email) : <UserRound className="size-4" />}
      </ProfilePhoto>
      {presentation !== "icon" && (
        <>
          <span className="min-w-0 flex-1 text-left">
            <span
              className={cn(
                "block truncate font-semibold text-sidebar-foreground",
                inCard ? "text-sm" : "text-xs",
              )}
            >
              {displayName.split(/\s+/)[0]}
            </span>
            {inCard && (
              <span
                className={cn(
                  "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                  profileIsPremium(profile)
                    ? "bg-warning text-warning-foreground"
                    : "bg-sidebar-accent text-sidebar-foreground/70",
                )}
              >
                {profileIsPremium(profile) ? "Premium" : "Free"}
              </span>
            )}
          </span>
        </>
      )}
    </Button>
  );

  // The form itself, shared by the desktop popover and the phone dialog.
  const form = (
    <>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <ProfilePhoto
            src={photo}
            alt={displayName}
            className="size-16"
            fallbackClassName="text-base"
          >
            {initials(name || profile?.name, profile?.email)}
          </ProfilePhoto>
          <div className="min-w-0 space-y-2">
            <Button asChild variant="outline" size="sm">
              <Label htmlFor="profile-photo" className="cursor-pointer">
                <Camera className="size-4" />
                {translate("Choose photo", lang)}
              </Label>
            </Button>
            <Input
              id="profile-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
            {avatarFile && (
              <p className="truncate text-xs text-muted-foreground">{avatarFile.name}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-name">{translate("Name", lang)}</Label>
          <Input
            id="profile-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-phone">{translate("Phone", lang)}</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            placeholder="(99) 99999-9999"
            maxLength={15}
            onChange={(event) => setPhone(maskPhone(event.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-bio">{translate("Bio", lang)}</Label>
          <Textarea
            id="profile-bio"
            value={bio}
            maxLength={280}
            rows={4}
            onChange={(event) => setBio(event.target.value)}
          />
        </div>
      </div>

      {WHATSAPP_SECTION_VISIBLE ? (
        <section className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold">{translate("Study by WhatsApp", lang)}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {translate(
                  "Connect your account to prepare for English practice with EVO on WhatsApp.",
                  lang,
                )}
              </p>
            </div>
          </div>

          {whatsAppStatus.isLoading ? (
            <p className="text-xs text-muted-foreground">{translate("Loading", lang)}</p>
          ) : whatsAppStatus.data?.connectedPhone ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-brand-green">
                <Check className="size-4" aria-hidden="true" />
                {translate("Your WhatsApp is connected.", lang)}
              </p>
              <p className="text-xs text-muted-foreground">
                {translate("Connected number", lang)}: {whatsAppStatus.data.connectedPhone}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {translate(
                  "WhatsApp account linking is prepared, but English practice through WhatsApp is not active yet.",
                  lang,
                )}
              </p>
            </div>
          ) : whatsAppStatus.data?.ready ? (
            <div className="space-y-3">
              {whatsAppStatus.data.businessPhoneNumber ? (
                <p className="text-xs text-muted-foreground">
                  {translate("Send this code to the official Evoluir+ WhatsApp number:", lang)}{" "}
                  <span className="font-semibold text-foreground">
                    {whatsAppStatus.data.businessPhoneNumber}
                  </span>
                </p>
              ) : null}
              {whatsAppCode ? (
                <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-2xl font-bold tracking-[0.2em]">{whatsAppCode}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(whatsAppCode);
                          setWhatsAppCodeCopied(true);
                          toast.success(translate("Code copied.", lang));
                        } catch {
                          toast.error(translate("The text could not be copied.", lang));
                        }
                      }}
                    >
                      {whatsAppCodeCopied ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                      {translate("Copy code", lang)}
                    </Button>
                  </div>
                  {whatsAppCodeExpiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      {translate("Code expires at", lang)}{" "}
                      {new Date(whatsAppCodeExpiresAt).toLocaleTimeString(
                        lang === "pt" ? "pt-BR" : "en-US",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {lang === "pt"
                      ? "No WhatsApp, envie: CONECTAR " + whatsAppCode
                      : "In WhatsApp, send: CONNECT " + whatsAppCode}
                  </p>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={createWhatsAppCode.isPending}
                onClick={() => createWhatsAppCode.mutate()}
              >
                {createWhatsAppCode.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <MessageCircle className="size-4" aria-hidden="true" />
                )}
                {translate(
                  createWhatsAppCode.isPending ? "Generating…" : "Generate connection code",
                  lang,
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {translate(
                "The WhatsApp connection is not available yet. The official Meta setup is still being completed.",
                lang,
              )}
            </p>
          )}
        </section>
      ) : null}

      <div className="flex flex-row items-center justify-between gap-2">
        <AdminPanelButton showLabel className="mr-auto" />
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {save.isPending ? translate("Saving...", lang) : translate("Save profile", lang)}
        </Button>
      </div>
    </>
  );

  // One card (user request: the loose rows looked cramped), in the desktop
  // sidebar and the phone menu alike: the photo, name and plan on top, then
  // the gear, language and bell as three equal buttons under a divider.
  const profileCard = (trigger: ReactNode) => (
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/25 p-1.5">
      {trigger}
      <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-sidebar-border pt-1.5">
        <Button
          ref={gearRef}
          variant="ghost"
          aria-label={translate("Edit profile", lang)}
          title={translate("Edit profile", lang)}
          className="h-9 w-full rounded-lg px-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => setOpen((value) => !value)}
        >
          <Settings className="size-[1.15rem]" aria-hidden="true" />
        </Button>
        {toolbar}
      </div>
    </div>
  );

  // Desktop sidebar (user request): opens right above its button, like a menu
  // from the sidebar's footer, not centred on the screen.
  if (presentation === "dashboard-sidebar") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        {profileCard(<PopoverTrigger asChild>{triggerButton}</PopoverTrigger>)}
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          onPointerMove={resetCloseTimer}
          onKeyDown={resetCloseTimer}
          onClick={resetCloseTimer}
          // The gear toggles the popover itself; its click is not "outside".
          onInteractOutside={(event) => {
            if (gearRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          className={cn(
            "dashboard-shell dark max-h-[calc(100dvh-2rem)] w-[min(21rem,calc(100vw-2rem))] space-y-4 overflow-y-auto p-5",
            graphitePanelClass,
          )}
        >
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold leading-none">
              {translate("Profile", lang)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translate("Update your photo and personal details.", lang)}
            </p>
          </div>
          {form}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {presentation === "mobile-menu" ? (
        profileCard(<DialogTrigger asChild>{triggerButton}</DialogTrigger>)
      ) : (
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      )}
      <DialogContent
        onPointerMove={resetCloseTimer}
        onKeyDown={resetCloseTimer}
        onClick={resetCloseTimer}
        // Translucent graphite like Weather talk and the bell (user request).
        // Phones: inset from the edges with rounded corners and never taller than
        // the screen; a darker dim there, since the side menu stays open behind.
        overlayClassName="bg-black/60 lg:bg-black/30"
        className={cn(
          "dashboard-shell dark max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl",
          graphitePanelClass,
        )}
      >
        <DialogHeader>
          <DialogTitle>{translate("Profile", lang)}</DialogTitle>
          <DialogDescription>
            {translate("Update your photo and personal details.", lang)}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
