# Hybridator

Lis ces documents pour comprendre le projet et suit tout à la lettre de bout en bout ; Veuille à ne figer les données qui peuvent etre changés plus tard (Nom de la plateforme, tarifs, etc)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hybridator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b44edd79-ad28-47d8-b35b-2de3bfff6b03).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and [pnpm](https://pnpm.io) 9+.

```sh
git clone <this-repository-url>
cd <repository-name>
pnpm install
pnpm dev
```

Monorepo layout: `apps/web-pwa` (UI V0), `apps/desktop` / `apps/mobile` (stubs), `packages/*` (core TypeScript).

```sh
pnpm verify   # typecheck + lint + test + no-React guard on core packages
```
