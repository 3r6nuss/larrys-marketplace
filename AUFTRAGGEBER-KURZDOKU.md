# Ausfallsicherung von Larrys

- Ein Raspberry Pi dient als zweiter Server und haelt Larrys beim Ausfall des Hauptservers erreichbar.
- Cloudflare schaltet automatisch auf den Raspberry Pi um; Webadresse und Bedienung bleiben unveraendert.
- Beide Server verwenden dieselbe externe Datenbank und denselben Bildspeicher, sodass Anmeldungen und Daten erhalten bleiben.
- Die Ausfallsicherung ersetzt kein Backup; automatische Datenbank-Backups werden weiterhin benoetigt.