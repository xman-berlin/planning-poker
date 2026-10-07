# Demo-Pfad

Zwei Browser-Profile, zum Beispiel ein normales Fenster und ein privates Fenster. Server mit `npm start`, dann [http://localhost:3000](http://localhost:3000).

1. **Session erstellen.** Im ersten Fenster einen Namen eintragen und auf „Session erstellen“ klicken. Die Seite wechselt zu `/s/` plus sechs Zeichen. Du bist Moderator. „Link kopieren“ merkt sich die Adresse.
2. **Beitreten.** Im zweiten Profil den Link öffnen. Ohne Namen bleibt der Button wirkungslos bzw. das Feld verlangt eine Eingabe. Namen eintragen, als Teilnehmer beitreten. Beide sehen die Person sofort in der Liste, der Moderator ist gekennzeichnet.
3. **Optional Beobachter.** Ein drittes Fenster tritt als Beobachter bei. Die Person erscheint mit dem Hinweis Beobachter und kann keine Karte wählen. Sie zählt nicht bei „x von y haben abgestimmt“.
4. **Verdeckt schätzen.** Beide Schätzenden wählen eine Fibonacci-Karte. Die andere Seite sieht „hat abgestimmt“, nicht den Wert. Eine andere Karte ändert die eigene Schätzung, solange nicht aufgedeckt ist.
5. **Aufdecken.** Nur der Moderator sieht „Karten aufdecken“. Danach sind alle Werte gleichzeitig da, dazu Durchschnitt, Median, Markierung der niedrigsten und höchsten Zahl. Gleiche Zahlen zeigen **Konsens**.
6. **Story, Diskussion, Verlauf.** Titel, Beschreibung und Ticket eintragen. Eine kurze Notiz senden. „Ergebnis sichern“ hängt die Runde an den Verlauf. „CSV“ lädt die Historie herunter, „Verlauf kopieren“ legt den Text in die Zwischenablage.
7. **Neue Runde.** „Neue Runde“ leert die Stimmen, die Personen bleiben, die nächste Story kann sofort beginnen. War noch nichts gesichert, landet das Ergebnis trotzdem im Verlauf.
8. **T-Shirt und Timer.** Vor der nächsten Schätzung das Deck auf T-Shirt stellen. S, M, L, XL schätzen und aufdecken: kein Durchschnitt, dafür die Spanne und bei Einigkeit wieder Konsens. Timer auf 0:30 starten. Beide sehen den Countdown. Bei null passiert kein automatisches Aufdecken.
9. **Dunkles Design und schmales Fenster.** „Dunkel“ umschalten, Seite neu laden: die Wahl bleibt. Das Fenster schmal ziehen: Karten, Aktionen und Liste bleiben benutzbar.

Getrenntes WLAN oder ein geschlossenes Fenster setzt die Person auf offline. Die Session läuft weiter.

10. **Neustart.** Server stoppen und erneut `npm start`. Denselben Link öffnen. Verlauf, Story und eine noch offene Runde sind noch da. Im selben Browser bleibst du Moderator bzw. behältst deine verdeckte Stimme. In einem frischen Browser denselben Namen eingeben: der alte Platz wird übernommen, solange niemand sonst so heißt und die Person gerade offline ist.
