import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getLeague, DAYS_PER_LEAGUE } from "@/components/LeagueBadge";
import { Button } from "@/components/ui/button";
import { downloadLeagueReport } from "@/lib/leagueReport";

/** Offers the personalised 15-day course PDF once a league has been completed. */
export function LeagueReportButton({
  userId,
  name,
  level,
  streakDays,
}: {
  userId: string;
  name: string;
  level: string;
  streakDays: number;
}) {
  const [loading, setLoading] = useState(false);
  if (streakDays < DAYS_PER_LEAGUE) return null;

  const league = getLeague(streakDays);

  const handleClick = async () => {
    setLoading(true);
    try {
      const saved = await downloadLeagueReport(userId, { name, level, streakDays });
      if (saved) toast.success("Your league report is downloading.");
      else
        toast.info(
          "Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again.",
        );
    } catch {
      toast.error("Could not build your report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 h-auto min-h-10 w-full whitespace-normal py-2 text-center text-xs leading-tight"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      Download {league.name} league PDF ({DAYS_PER_LEAGUE} days)
    </Button>
  );
}
