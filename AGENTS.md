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
- The Dashboard Today's Focus must use the complete, unedited `Evo_novo_Dashboard.jpg` attachment through its CDN pointer; never remove its background, and keep it left of the text on mobile. Other EVO placements remain unchanged.
- Dashboard visual tokens and dark surfaces stay scoped under `dashboard-shell`; this preserves the shared light/dark presentation of every other authenticated page.
- Dashboard desktop height uses dynamic viewport units with a `vh` fallback and a 50px safety budget; this prevents browser-specific vertical scroll.
- Daily Reflection weather is a client-only visual enhancement using permitted geolocation and Open-Meteo; deterministic sun/moon remains the no-location fallback.
