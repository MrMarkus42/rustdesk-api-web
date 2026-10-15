**Deutsch** · [English](README.en.md)

# RustDesk API – Admin-Oberfläche

Admin-Oberfläche für die [RustDesk-API](https://github.com/MrMarkus42/rustdesk-api), gebaut mit Vue 3 und Element Plus. Sie wird beim Build der API eingebunden und ist dort unter `/_admin/` erreichbar.

Fork von [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web), das nicht mehr gepflegt wird.

## Änderungen gegenüber lejianwen

- **Deutsche Übersetzung**, die Sprache wird aus dem Browser übernommen; fehlende Übersetzungen fallen auf Englisch zurück statt interne Schlüssel anzuzeigen
- Aktualisierte Abhängigkeiten (axios, Vue, Vite u. a.), `npm audit` ohne Befund
- Filterformulare mit automatischer Beschriftungsbreite

## Entwickeln und bauen

```bash
npm ci
npm run dev      # Entwicklungsserver, API-Ziel in .env.development (VITE_SERVER_PATH)
npm run build    # Ergebnis in dist/
```

Der Build der API ([MrMarkus42/rustdesk-api](https://github.com/MrMarkus42/rustdesk-api)) verwendet einen fest angegebenen Commit dieses Repositorys. Neue Änderungen hier gelangen erst in die API, wenn dieser Commit dort angehoben wird.

## Übersetzungen

Die Texte liegen in `src/utils/i18n/<sprache>.json`. Neue Schlüssel bitte mindestens in `en.json` und `de.json` ergänzen.

## Herkunft und Lizenz

- Ursprüngliches Projekt: [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web) ([Beschreibung Chinesisch](README_ZH.md))
- Lizenz: [MIT](LICENSE)
