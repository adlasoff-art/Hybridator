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

## Architecture rules
- All commercial/brand values (name, plans, prices, currency, trial, quotas, presets, feature flags) live in `src/config/product.ts` and are read via `useProductConfig()`; never hardcode them in pages — they will change and later come from the backend.
- `src/engine/` is pure TypeScript with no React imports; UI only dispatches `EditOperation`s — keeps the engine portable to the future native/monorepo packages.
- File/media/sync access goes through the adapters in `src/engine/adapters.ts` — lets web, desktop and cloud runtimes swap implementations.
- Edits are non-destructive: source assets are never mutated; removals are recorded as source-time ranges — required by the product spec.
