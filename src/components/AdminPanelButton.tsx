// Gear button that opens the admin page. The gear only renders when the server
// confirms the signed-in user is the authorized admin; the admin page itself is
// also protected server-side, so a normal user navigating there directly gets
// redirected back to the dashboard.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function AdminPanelButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const navigate = useNavigate();

  const checkAdmin = useServerFn(isAdminUser);

  const adminQuery = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (adminQuery.data?.isAdmin !== true) return null;

  return (
    <Button
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      aria-label={t("Admin panel")}
      className={className}
      onClick={() => void navigate({ to: "/admin" })}
    >
      <Settings className="size-5" />
      {showLabel && <span>{t("Admin panel")}</span>}
    </Button>
  );
}
