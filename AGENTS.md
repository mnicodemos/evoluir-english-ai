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
- Dashboard Today's Focus uses the complete approved EVO image on desktop and the supplied wide EVO banner on mobile through CDN pointers; mobile media stays flush to the top and sides. Other EVO placements remain unchanged.
- `dashboard-shell` dark tokens are applied by AppShell to every authenticated page (user request: one visual identity); portaled surfaces like the Admin dialog opt in with their own `dashboard-shell dark` class.
- Dashboard desktop height uses dynamic viewport units with a `vh` fallback and a 50px safety budget; this prevents browser-specific vertical scroll.
- Daily Reflection weather is a client-only visual enhancement using permitted geolocation and Open-Meteo; deterministic sun/moon remains the no-location fallback.
- Public home and auth opt into Dashboard tokens through `brand-dashboard-theme`; this shares visual identity without changing shared authenticated screens.
- AI Teacher, My History, and lesson openings share the complete horizontal EVO image with contain-fit; this preserves all artwork without cropping.
- Path lessons are repaired on open from the lesson page (any entry link) and AI lesson replies are salvaged item by item; an interrupted or imperfect generation must never leave a lesson without its quiz.
- Study streak days are credited only in the database (credit_study_day, fired by triggers on activities, user_lessons and user_vocabulary); clients never write streak fields, so the daily rule has one home.
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
