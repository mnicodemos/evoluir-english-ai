import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { TomatoIcon } from "./TomatoIcon";
import { useLifeT } from "@/components/life/LifeNav";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import {
  canStartOfferedFocus,
  createFocusOfferGate,
  STUDY_STARTED_EVENT,
} from "@/lib/focusStudyOffer";
import { focusStart, getFocusSnapshot, openFocusWidget } from "@/lib/focusTimer";
import { FOCUS_PRESETS } from "@/lib/life";

const claimOffer = createFocusOfferGate();
const TOAST_ID = "focus-study-invitation";

/** Nonblocking: beginning study offers the existing timer, never starts it. */
export function FocusStudyInvitation() {
  const { data: profile } = useProfile();
  const { t } = useLifeT();
  const { state } = useFocusTimer();
  const pendingOffer = useRef(false);

  useEffect(() => {
    const offer = () => {
      if (!profile?.id) {
        pendingOffer.current = true;
        return;
      }
      const current = getFocusSnapshot().state;
      if (!claimOffer(profile.id, current)) return;
      pendingOffer.current = false;
      const minutes = FOCUS_PRESETS[current.preset].focus;
      toast(t("Start Focus for your study?"), {
        id: TOAST_ID,
        icon: <TomatoIcon className="size-5 text-brand-green" />,
        description: t("Start a {minutes}-minute focus block?").replace(
          "{minutes}",
          String(minutes),
        ),
        duration: 15000,
        action: {
          label: t("Start Focus"),
          onClick: () => {
            if (!canStartOfferedFocus(getFocusSnapshot().state)) return;
            focusStart();
            openFocusWidget();
          },
        },
        cancel: { label: t("Not now"), onClick: () => undefined },
      });
    };
    window.addEventListener(STUDY_STARTED_EVENT, offer);
    if (pendingOffer.current) offer();
    return () => {
      window.removeEventListener(STUDY_STARTED_EVENT, offer);
    };
  }, [profile?.id, t]);

  useEffect(() => {
    if (state.phase !== "idle") toast.dismiss(TOAST_ID);
  }, [state.phase]);

  return null;
}
