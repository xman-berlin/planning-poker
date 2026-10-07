# Planungspoker

Planning-Poker-Prototyp für BRZ-Teams. Eine Node-Anwendung liefert die Oberfläche und die Live-Session. Kein Konto, keine externe Datenbank, keine API-Keys.

## Start

```bash
npm install
npm start
```

Der Server hört auf `PORT`, sonst **3000**: [http://localhost:3000](http://localhost:3000)

`npm start` baut das Frontend und startet danach den Server. Entwicklung mit Hot-Reload: `npm run dev` (Oberfläche auf Port 5174, API auf 3000).

## Teilen

Wer eine Session erstellt, wird **Moderator** und landet auf `/s/ABC123`. Der Button **Link kopieren** legt genau diese Adresse in die Zwischenablage. Andere öffnen den Link, geben einen Namen ein und treten als Teilnehmer oder Beobachter bei.

## Rollen

- **Moderator**: die Person, die die Session erstellt. Nur sie deckt auf, startet eine neue Runde, wechselt das Deck, stellt den Timer und bearbeitet Titel, Beschreibung und Ticket. Die Moderation kann an eine anwesende Person übergeben werden. Ist der Moderator offline, kann ein Teilnehmer sie übernehmen.
- **Teilnehmer**: schätzt mit. Die Karte bleibt verdeckt und kann bis zum Aufdecken geändert werden. Andere sehen nur „hat abgestimmt“.
- **Beobachter**: steht in der Liste, stimmt nicht, zählt nicht bei „x von y“.

## Decks und Auswertung

- **Fibonacci**: 0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, Kaffeepause. Durchschnitt und Median ignorieren ? und Kaffeepause. Niedrigste und höchste Zahl werden markiert.
- **T-Shirt**: S, M, L, XL. Kein Durchschnitt und kein Median. Die Reihenfolge ist S &lt; M &lt; L &lt; XL, kleinste und größte Größe werden markiert.
- Das Deck wechselt nur zu Rundenbeginn, bevor jemand geschätzt hat.
- Sind mindestens zwei vergleichbare Stimmen gleich, erscheint **Konsens**.

## Weitere Funktionen

- Timer mit 0:30, 1:00, 2:00, 3:00, 5:00. Alle sehen den Countdown. Bei null bleibt die Runde verdeckt.
- Nach dem Aufdecken gibt es eine kurze Diskussion ohne Konten.
- **Ergebnis sichern** schreibt Story, Stimmen, Durchschnitt, Median und Zeitpunkt in den Verlauf. Eine neue Runde übernimmt ein noch nicht gesichertes Ergebnis automatisch.
- Verlauf kopieren oder als CSV speichern. Dunkles Design bleibt in `localStorage`.

## Speicher

Jede Änderung landet in `data/sessions.json` auf dem Server. Der Ordner wird beim Start angelegt und gehört nicht ins Git. Ein Neustart von `npm start` lädt alle Sessions wieder: derselbe Link `/s/XXXXXX` zeigt Verlauf, Story, Deck, Chat, Timer und eine laufende Runde inklusive verdeckter Stimmen.

Im Browser merkt sich `localStorage` die Teilnahme (`pp-member:<sessionId>`). Dieselbe Person behält nach einem Neuladen oder Serverneustart Platz, Stimme und Moderatorenrolle. In einem anderen Browser reicht der bisherige Name, solange er offline und in der Session eindeutig ist. Wer die Session verlässt, gibt den Platz frei. Verlässt die letzte Person die Session, wird sie auch von der Platte gelöscht. Getrennte Personen bleiben offline in der Liste, bis sie wieder beitreten oder selbst gehen.

## Tests

```bash
npm test
npm run smoke
```
