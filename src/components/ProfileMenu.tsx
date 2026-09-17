import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { cn } from "@/lib/utils";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function translate(label: string, lang: "en" | "pt") {
  return lang === "pt" ? (uiPt[label] ?? label) : label;
}

function initials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.split("@")[0] || "User").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : source[1] ?? "";
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

function useAvatarUrl(path?: string | null) {
  return useQuery({
    queryKey: ["avatar-url", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function ProfileMenu({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const { lang } = useUiLang();
  const { data: profile } = useProfile();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setPhone(maskPhone(profile?.phone ?? ""));
    setBio(profile?.bio ?? "");
    setAvatarFile(null);
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
        const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, avatarFile, {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate("Edit profile", lang)}
          className={cn("size-10 rounded-lg p-0 text-sidebar-foreground/70", className)}
        >
          <Avatar className="size-8 border border-border bg-muted">
            <AvatarImage src={photo} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-accent text-[11px] font-bold text-accent-foreground">
              {profile ? initials(profile.name, profile.email) : <UserRound className="size-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{translate("Profile", lang)}</DialogTitle>
          <DialogDescription>{translate("Update your photo and personal details.", lang)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border border-border bg-muted">
              <AvatarImage src={photo} alt={displayName} className="object-cover" />
              <AvatarFallback className="bg-accent text-base font-bold text-accent-foreground">
                {initials(name || profile?.name, profile?.email)}
              </AvatarFallback>
            </Avatar>
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

        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {save.isPending ? translate("Saving...", lang) : translate("Save profile", lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
