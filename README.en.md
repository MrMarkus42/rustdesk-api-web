[Deutsch](README.md) · **English**

# RustDesk API – Admin interface

Admin interface for the [RustDesk API](https://github.com/MrMarkus42/rustdesk-api), built with Vue 3 and Element Plus. It is bundled when the API is built and served at `/_admin/`.

Fork of [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web), which is no longer maintained.

## Changes compared to lejianwen

- **German translation**; the language follows the browser, and missing translations fall back to English instead of showing internal keys
- Updated dependencies (axios, Vue, Vite and others), `npm audit` clean
- Filter forms with automatic label width
- **Web client** (`src/remote/`, `src/views/remote/`): own implementation of the RustDesk protocol in the browser with a toolbar like the app's (pin, fold, move): picture (VP9, VP8, AV1, H.264/H.265 via WebCodecs, 4:4:4), single or all screens, scaling, image quality, codec, resolution, virtual displays, privacy mode, block input, restart, elevation, keyboard modes (1:1, translate, legacy), view only, relative mouse mode, remote cursor, quality monitor, sound, text chat, clipboard (text), screenshot and recording; login with password, saved address book password, 2FA or acceptance at the device. Settings are kept per device in the browser

## Develop and build

```bash
npm ci
npm run dev      # dev server, API target in .env.development (VITE_SERVER_PATH)
npm run build    # output in dist/
```

The API build ([MrMarkus42/rustdesk-api](https://github.com/MrMarkus42/rustdesk-api)) uses a pinned commit of this repository. New changes here only reach the API once that commit is bumped there.

The protocol files `src/remote/proto/*.proto` come from RustDesk; code generated from them is in `src/remote/gen/` and is regenerated with `npm run gen:proto`.

## Translations

Texts live in `src/utils/i18n/<language>.json`. Add new keys to at least `en.json` and `de.json`.

## Origin and license

- Original project: [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web) ([Chinese description](README_ZH.md))
- License: [MIT](LICENSE); the protocol files in `src/remote/proto/` come from [RustDesk](https://github.com/rustdesk/rustdesk) (AGPL-3.0)
