import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TomatoIcon } from "./TomatoIcon";
import { showAppNotification } from "@/components/ui/AppNotificationToast";
import { EvoAvatar } from "@/components/EvoAvatar";
import { toast } from "sonner";
import { useLifeT } from "@/components/life/LifeNav";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import {
  canStartOfferedFocus,
  createFocusOfferGate,
  STUDY_STARTED_EVENT,
} from "@/lib/focusStudyOffer";
import { focusSetActivity, focusStart, getFocusSnapshot, openFocusWidget } from "@/lib/focusTimer";
import type { FocusActivity } from "@/lib/life";
import { FOCUS_PRESETS } from "@/lib/life";
import { getFocusInvitationEnabled } from "@/lib/focusInvitationPreference";

const claimOffer = createFocusOfferGate();
const TOAST_ID = "focus-study-invitation";

export function FocusStudyInvitation() {
  const { data: profile } = useProfile();
  const focusInvitation = useQuery({
    queryKey: ["focus-invitation-enabled", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => getFocusInvitationEnabled(profile!.id),
    staleTime: 60_000,
  });
  const { t } = useLifeT();
  const { state } = useFocusTimer();
  const pendingOffer = useRef(false);
  const pendingActivity = useRef<FocusActivity | null>(null);
  const pendingActivityKey = useRef("general");

  useEffect(() => {
    const offer = (event?: Event) => {
      const detail = (event as CustomEvent<{ activity?: FocusActivity }> | undefined)?.detail;
      if (detail?.activity) pendingActivity.current = detail.activity;
      if (event) {
        pendingActivityKey.current = `${window.location.pathname}${window.location.search}`;
      }
      if (focusInvitation.data === false) return;
      if (!profile?.id) {
        pendingOffer.current = true;
        return;
      }
      const current = getFocusSnapshot().state;
      if (!claimOffer(profile.id, current, undefined, pendingActivityKey.current)) return;
      pendingOffer.current = false;
      const minutes = FOCUS_PRESETS[current.preset].focus;
      showAppNotification({
        id: TOAST_ID,
        title: t("EVO invites you to focus"),
        description: t("Start a {minutes}-minute focus block?").replace(
          "{minutes}",
          String(minutes),
        ),
        variant: "info",
        icon: <EvoAvatar className="size-9 sm:size-9" decorative />,
        iconShape: "circle",
        cornerIcon: <TomatoIcon className="size-5 text-rose-400" />,
        duration: 15000,
        action: {
          label: t("Start Focus"),
          onClick: () => {
            if (!canStartOfferedFocus(getFocusSnapshot().state)) return;
            focusSetActivity(pendingActivity.current);
            focusStart();
            openFocusWidget();
          },
        },
        cancel: { label: t("Not now"), onClick: () => undefined },
      });
    };
    window.addEventListener(STUDY_STARTED_EVENT, offer);
    if (pendingOffer.current) offer();
    return () => window.removeEventListener(STUDY_STARTED_EVENT, offer);
  }, [profile?.id, focusInvitation.data, t]);

  useEffect(() => {
    if (state.phase !== "idle") toast.dismiss(TOAST_ID);
  }, [state.phase]);

  return null;
}
