import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { BrandName } from "@/components/BrandName";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, recoveryLinkError } from "@/lib/authErrors";
import { uiPt } from "@/lib/uiDictionary";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha - Evoluir+ English AI" },
      { name: "description", content: "Defina uma nova senha para sua conta Evoluir+ English AI." },
      { property: "og:title", content: "Nova senha - Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Defina uma nova senha para sua conta Evoluir+ English AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

/** How long to wait for the recovery session to arrive from the e-mail link. */
const LINK_CHECK_MS = 3000;

function ResetPasswordPage() {
  const navigate = useNavigate();
  // Like the sign-in screen, this page is always in Portuguese.
  const t = (label: string) => uiPt[label] ?? label;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // "checking" until the link's session arrives; "invalid" for an expired or used link.
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid">("checking");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    const fromLink = recoveryLinkError(new URL(window.location.href));
    if (fromLink) {
      setLinkError(fromLink);
      setLinkState("invalid");
      return;
    }
    let settled = false;
    const ready = () => {
      settled = true;
      setLinkState("ready");
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) ready();
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) ready();
    });
    const timer = window.setTimeout(() => {
      if (!settled) setLinkState("invalid");
    }, LINK_CHECK_MS);
    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("The passwords do not match."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("Password updated"));
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-shell brand-dashboard-theme dark flex min-h-dvh flex-col bg-background text-foreground">
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2">
            <Logo className="size-[1.5rem]" />
            <BrandName />
          </Link>

          {linkState === "checking" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> {t("Checking your link…")}
            </div>
          ) : linkState === "invalid" ? (
            <div className="card-soft p-7 text-center">
              <h1 className="text-xl font-semibold">{t("This link is no longer valid")}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {linkError ??
                  t("Reset links expire after a while and work only once. Ask for a new one.")}
              </p>
              <Button asChild className="mt-6 w-full">
                <Link to="/auth" search={{ mode: "forgot" }}>
                  {t("Ask for a new link")}
                </Link>
              </Button>
              <p className="mt-4 text-sm">
                <Link
                  to="/auth"
                  className="font-medium text-muted-foreground underline underline-offset-4"
                >
                  {t("Back to sign in")}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{t("Create a new password")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("Choose a new password to finish signing in.")}
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("New password")}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      aria-describedby="new-password-hint"
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={t(showPassword ? "Hide password" : "Show password")}
                      className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p id="new-password-hint" className="text-xs text-muted-foreground">
                    {t("At least 6 characters.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("Confirm the new password")}</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    aria-invalid={confirm.length > 0 && confirm !== password}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="text-xs text-destructive">{t("The passwords do not match.")}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {t("Save new password")}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link
                  to="/auth"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {t("Back to sign in")}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
      <Footer minimal leftAligned lang="pt" />
    </div>
  );
}
