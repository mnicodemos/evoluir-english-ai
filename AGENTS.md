<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Dashboard-only density and navigation styling must use opt-in presentation props on existing components, preserving their shared data and behavior.
- Dashboard Today's Focus uses the complete approved EVO image on desktop (CDN pointer) and, on mobile, the owner's full "More than English" banner uncropped (src/assets/evo-banner-mobile-full.webp), inset from the card edges with rounded corners like the desktop image (user request); the content below is centred in the card's free height. Other EVO placements remain unchanged.
- `dashboard-shell` dark tokens are applied by AppShell to every authenticated page (user request: one visual identity); portaled surfaces like the Admin dialog opt in with their own `dashboard-shell dark` class.
- Dashboard desktop height uses dynamic viewport units with a `vh` fallback as a minimum (min-height), and its card rows have content-based minimums; a row whose cards need more room grows instead of letting cards overlap the next row.
- Skill scores everywhere (Dashboard card, My Progress, league PDF) come from the evidence layer (current_skill_profile via loadNextStep `skills`), never from the legacy best-ever `progress` table; reading-lesson quizzes also record reading evidence.
- Weather is an English practice ("Weather talk" popover in the Dashboard header → AI Speaking ?weather=); location is requested only on tap or when already granted, never on page load, and sun/moon by the hour is the fallback.
- Public home and auth opt into Dashboard tokens through `brand-dashboard-theme`; this shares visual identity without changing shared authenticated screens.
- AI Teacher, AI Speaking, the My Progress journey and lesson openings show EVO as the owner's round portrait (EvoAvatar, src/assets/evo-guide.webp, the same circle as the First week guide) instead of the old horizontal strip (user request).
- Path lessons are repaired on open from the lesson page (any entry link) and AI lesson replies are salvaged item by item; an interrupted or imperfect generation must never leave a lesson without its quiz.
- Study streak days are credited only in the database (credit_study_day, fired by triggers on activities, user_lessons and user_vocabulary); clients never write streak fields, so the daily rule has one home.
- Streak protection (one missed day per week, Monday to Sunday in São Paulo) is applied only by credit_study_day into streak_freeze_used_on; src/lib/streakFreeze.ts mirrors it for display, so a protected streak never looks broken.
- Weekly league XP is computed only in the database (league_week_xp / weekly_league); other students are exposed only by first name + initial and only after they opt in (profiles.league_opt_in).
- Weekly and monthly frequency views read the same qualifying evidence as `credit_study_day`; this keeps presentation aligned while the database remains the sole streak writer.
- Vocabulary word generation uses the faster Lovable AI model (LOVABLE_VOCABULARY_MODEL); the slower talking model exceeded the 60 s call limit and left batches empty.
- Vocabulary AI replies are salvaged word by word and the browser releases a stuck generation after 80 s; one bad item or a dropped connection must never leave a lesson's batch empty.
- Vocabulary generation runs under the host's keep-alive (keepAlive in src/lib/keepAlive.server.ts, context set in src/server.ts); leaving the lesson screen mid-generation must not cancel the batch.
- Dashboard mobile uses a fixed five-item bottom navigation on every authenticated page (bottom padding comes from the shell, not each page) and there are no top back-to-Dashboard buttons; desktop composition remains unchanged.
- Administrative authorization is decided server-side through `user_roles` and `has_role`; email addresses are never authorization rules.
- Vocabulary "I know it" climbs a spaced-review ladder (src/lib/vocabularyReview.ts: mastery_level = step, next_review_at = due date); Learned stays mastery_level >= 75 so every count shares one threshold.
- Pending Listening, Writing, and Vocabulary state may trigger app notifications but must not render novelty circles in mobile navigation.
- Daily push (word of the day, study reminder) runs from pg_cron calling /api/public/cron/daily-push, authenticated by the service-only push_cron_key row; the app need not be open.
- Public legal documents share one bilingual presentation component while keeping independent routes and metadata; this prevents copy and layout drift.
- Lovable Publish does not apply new files in drizzle/migrations; each new migration must be applied by asking the Lovable chat to run it (it re-registers the SQL under the next number), followed by `NOTIFY pgrst, 'reload schema'`, so every migration must stay idempotent.
- The weekly league image is the owner's artwork of EVO with the "More than English" trophy (src/assets/evo-liga-simbolo.webp, cut to a transparent circle); it appears only on the league page (header symbol and empty ranking). Other screens use the standard EVO profile image, except the screens where EVO speaks in a circle (First week guide, AI Teacher, AI Speaking, My Progress journey, lesson openings), which use the owner's portrait cropped to her face (src/assets/evo-guide.webp, EvoAvatar).
- The Dashboard level chips are read-only: a conquered level opens /learning?review=<level> to review its lessons (all open, no unit/final tests) without changing profiles.level; the weekly league groups by coalesce(max_level, level), so reviewing never moves a student into an easier league.
- The video call (/call) shows the owner's photo of EVO on the phone (src/assets/evo-video-call.jpg) in a round video window; it is used only on the call screen.
- Interface language rule: every student screen follows the language the student picks (uiLang, Portuguese by default); screen text is written in English and translated through uiPt, and English stays only in learning content (lessons, vocabulary, quizzes, AI replies), whose containers carry translate="no". src/lib/uiLanguageRule.test.ts enforces it; Admin (owner only) and the public Portuguese pages are outside the rule.
- Failure alerts: every daily-push run is recorded in push_runs, and src/lib/opsAlerts.ts decides what needs attention (a scheduled push that failed or has not run for 26 h, AI calls failing in the last 24 h); the Admin shows them on top, and the morning run (or any failed run) sends the admins (user_roles) one push.
- Onboarding has three steps (about you, adaptive placement test, level + daily time) and ends in "Talk to EVO now" (AI Speaking); the placement test stops once a CEFR band is fully missed (placementComplete), so beginners never type C2 answers. The Admin Retention tab measures signup to first spoken answer.
- AI Speaking speed: a streamed reply is spoken after its first sentence (takeStreamBlocks), each block's audio is prepared as soon as it arrives (prepareSpeech, one request at a time), and the browser records the wait per answer in speaking_turn_timings (migration 0050), shown in Admin → Cost & Performance.
- Product goals (src/lib/productAlerts.ts): the Admin alerts also warn when EVO takes over 3 s to start speaking (median, ≥20 answers) or the slowest 10% over 6 s, when D1 return is under 30% or first-day conversations under 50% (≥10 students); warnings only, never pushed. Retention and speaking wait are loaded once in src/lib/productMetrics.server.ts for the tabs and the alerts.
