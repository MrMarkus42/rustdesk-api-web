**Deutsch** · [English](README.en.md)

# RustDesk API – Admin-Oberfläche

Admin-Oberfläche für die [RustDesk-API](https://github.com/MrMarkus42/rustdesk-api), gebaut mit Vue 3 und Element Plus. Sie wird beim Build der API eingebunden und ist dort unter `/_admin/` erreichbar.

Fork von [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web), das nicht mehr gepflegt wird.

## Änderungen gegenüber lejianwen

- **Deutsche Übersetzung**, die Sprache wird aus dem Browser übernommen; fehlende Übersetzungen fallen auf Englisch zurück statt interne Schlüssel anzuzeigen
- Aktualisierte Abhängigkeiten (axios, Vue, Vite u. a.), `npm audit` ohne Befund
- Filterformulare mit automatischer Beschriftungsbreite
- **Web-Client** (`src/remote/`, `src/views/remote/`): eigene Umsetzung des RustDesk-Protokolls im Browser mit einer Menüleiste wie in der App (anheften, einklappen, verschieben): Bild (VP9, VP8, AV1, H.264/H.265 über WebCodecs, 4:4:4), einzelne oder alle Bildschirme, Skalierung, Bildqualität, Codec, Auflösung, virtuelle Anzeigen, Datenschutzmodus, Eingabesperre, Neustart, Rechte anfordern, Tastaturmodi (1:1, Translate, Legacy), Nur-Ansehen, relativer Mausmodus, Fern-Cursor, Qualitätsmonitor, Ton, Text-Chat, Zwischenablage (Text), Bildschirmfoto und Aufnahme; Anmeldung per Passwort, gespeichertem Adressbuch-Passwort, 2FA oder Annahme am Gerät. Einstellungen werden pro Gerät im Browser gespeichert

## Entwickeln und bauen

```bash
npm ci
npm run dev      # Entwicklungsserver, API-Ziel in .env.development (VITE_SERVER_PATH)
npm run build    # Ergebnis in dist/
```

Der Build der API ([MrMarkus42/rustdesk-api](https://github.com/MrMarkus42/rustdesk-api)) verwendet einen fest angegebenen Commit dieses Repositorys. Neue Änderungen hier gelangen erst in die API, wenn dieser Commit dort angehoben wird.

Die Protokolldateien `src/remote/proto/*.proto` stammen aus RustDesk; daraus erzeugter Code liegt in `src/remote/gen/` und wird mit `npm run gen:proto` neu erzeugt.

## Übersetzungen

Die Texte liegen in `src/utils/i18n/<sprache>.json`. Neue Schlüssel bitte mindestens in `en.json` und `de.json` ergänzen.

## Herkunft und Lizenz

- Ursprüngliches Projekt: [lejianwen/rustdesk-api-web](https://github.com/lejianwen/rustdesk-api-web) ([Beschreibung Chinesisch](README_ZH.md))
- Lizenz: [MIT](LICENSE); die Protokolldateien in `src/remote/proto/` stammen aus [RustDesk](https://github.com/rustdesk/rustdesk) (AGPL-3.0)
