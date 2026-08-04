# Gebraucht-Radar

Eine **Preisvergleichs-/Meta-Suche für Gebrauchtwaren** – die Idee von Idealo,
aber für Kleinanzeigen-Portale. Ein Suchbegriff durchsucht mehrere Verkaufsportale
(Kleinanzeigen.de, markt.de, …) gleichzeitig und macht die Angebote nach Preis
vergleichbar.

Das Projekt besteht aus zwei Teilen:

| Ordner      | Was                                                                      |
| ----------- | ------------------------------------------------------------------------ |
| `backend/`  | Aggregator-API (Node + TypeScript). Fragt alle Portale parallel ab.      |
| `mobile/`   | Mobile-App (Expo / React Native + TypeScript) für iOS & Android.         |

---

## Wichtiger Hinweis zum Datenzugriff (bitte zuerst lesen)

Die großen Portale (**Kleinanzeigen.de**, **markt.de**) bieten **keine offene
öffentliche API** und **untersagen in ihren AGB das automatische Auslesen
(Scraping)**; sie blocken Bots auch technisch. Ein produktiver Betrieb braucht
daher eine **offiziell erlaubte Datenquelle** (Partner-/Affiliate-Zugang) oder
eine rechtliche Klärung.

Damit die App trotzdem sofort funktioniert, ist sie über eine **Adapter-Architektur**
gebaut:

- Jede Quelle ist ein austauschbares Modul (`backend/src/providers/*`).
- Die **Demo-Quelle** liefert realistische, erfundene Angebote und ist immer aktiv.
- Die Adapter für **Kleinanzeigen** und **markt.de** sind als Struktur-Vorlage
  vorhanden, aber **standardmäßig deaktiviert**. Sie lassen sich nur für eigene,
  erlaubte Tests per Umgebungsvariable einschalten (siehe unten).

So kann die App vollständig getestet werden, und echte Quellen werden später
gezielt eingestöpselt, ohne den Rest zu ändern.

---

## Schnellstart

### 1. Backend starten

```bash
cd backend
npm install
npm start          # startet die API auf http://localhost:4000
```

Test:

```bash
curl "http://localhost:4000/search?q=iphone%2012&sort=price_asc&maxPrice=400"
```

Weitere nützliche Skripte:

```bash
npm run smoke      # schneller End-to-End-Test des Aggregators (ohne Server)
npm run typecheck  # TypeScript-Prüfung
```

### 2. Mobile-App starten

```bash
cd mobile
npm install
npx expo install   # gleicht Paketversionen mit dem Expo-SDK ab (empfohlen)
npm start          # startet Expo; QR-Code mit der "Expo Go"-App scannen
```

> **Wichtig für echte Geräte:** In `mobile/app.json` unter `expo.extra.apiBaseUrl`
> steht `http://localhost:4000`. Auf einem echten Handy zeigt `localhost` auf das
> Handy selbst – trage dort die **LAN-IP deines Rechners** ein, z. B.
> `http://192.168.1.20:4000`. Im Web-Modus (`npm run web`) funktioniert `localhost`.

---

## API-Überblick (Backend)

| Route      | Beschreibung                                                            |
| ---------- | ---------------------------------------------------------------------- |
| `GET /health`  | Health-Check.                                                     |
| `GET /sources` | Liste aller Portale inkl. Aktiv-Status (für die Filter-UI).       |
| `GET /search`  | Meta-Suche über alle aktiven Portale.                             |

**`/search`-Parameter:** `q` (Pflicht, ≥2 Zeichen), `sort`
(`price_asc` \| `price_desc` \| `newest`), `minPrice`, `maxPrice`, `location`,
`sources` (z. B. `kleinanzeigen,marktde`), `limit`.

Der Aggregator fragt alle aktiven Quellen **parallel** ab (mit Timeout),
**führt die Ergebnisse zusammen**, **filtert nach Preis**, **entfernt Duplikate**
und **sortiert**. Fällt eine Quelle aus, läuft die Suche weiter; der Ausfall wird
im `sources`-Teil der Antwort vermerkt.

---

## Eine neue Quelle hinzufügen

1. In `backend/src/providers/` eine Klasse anlegen, die das `Provider`-Interface
   (`provider.ts`) implementiert.
2. Den Provider in `backend/src/providers/index.ts` in `ALL_PROVIDERS` eintragen.
3. Die neue `SourceId` in `backend/src/types.ts` (und `mobile/src/types.ts`)
   ergänzen sowie optional ein Badge in `mobile/src/theme.ts`.

Mehr ist nicht nötig – Aggregation, API und App nutzen den Provider automatisch.

### Scraper-Adapter einschalten (nur für eigene, erlaubte Tests)

```bash
cd backend
ENABLE_KLEINANZEIGEN=true ENABLE_MARKTDE=true npm start
```

Beachte den AGB-Hinweis oben. Die Selektoren in den Adaptern sind bewusst
defensiv, da Portale ihr HTML regelmäßig ändern.

---

## Nächste sinnvolle Schritte

- Rechtlich saubere Datenquellen anbinden (Partner-/Affiliate-APIs).
- Detailansicht eines Inserats + Merkliste/Favoriten.
- Preis-Alarm (Benachrichtigung, wenn ein gesuchter Artikel unter X € auftaucht).
- Persistente gespeicherte Suchen und Verlauf.
