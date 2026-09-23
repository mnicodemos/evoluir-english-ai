import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { uiPt } from "@/lib/uiDictionary";
import { UiLangToggle, useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Nova senha" },
      { name: "description", content: "Defina uma nova senha para sua conta Evoluir+ English AI." },
      { property: "og:title", content: "Evoluir+ English AI · Nova senha" },
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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("Password updated"));
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="size-[1.2rem]" />
              <span className="font-display font-semibold">Evoluir+ English AI</span>
            </Link>
            <UiLangToggle />
          </div>

          <h1 className="text-2xl font-bold">{t("Create a new password")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Choose a new password to finish signing in.")}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("Password")}</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("Save new password")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
              {t("Back to sign in")}
            </Link>
          </p>
        </div>
      </div>
      <Footer leftAligned lang={lang} />
    </div>
  );
}
