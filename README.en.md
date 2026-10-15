[Deutsch](README.md) · **English**

# RustDesk API – Admin interface

Admin interface for the [RustDesk API](https://github.com/MrMarkus42/rustdesk-api), built with Vue 3 and Element Plus. It is bundled when the API is built and served at `/_admin/`.

Fork of [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web), which is no longer maintained.

## Changes compared to lejianwen

- **German translation**; the language follows the browser, and missing translations fall back to English instead of showing internal keys
- Updated dependencies (axios, Vue, Vite and others), `npm audit` clean
- Filter forms with automatic label width

## Develop and build

```bash
npm ci
npm run dev      # dev server, API target in .env.development (VITE_SERVER_PATH)
npm run build    # output in dist/
```

The API build ([MrMarkus42/rustdesk-api](https://github.com/MrMarkus42/rustdesk-api)) uses a pinned commit of this repository. New changes here only reach the API once that commit is bumped there.

## Translations

Texts live in `src/utils/i18n/<language>.json`. Add new keys to at least `en.json` and `de.json`.

## Origin and license

- Original project: [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web) ([Chinese description](README_ZH.md))
- License: [MIT](LICENSE)
