# Ausfallsicherung von Larrys

- Ein Raspberry Pi dient als zweiter Server und haelt Larrys beim Ausfall des Hauptservers erreichbar.
- Der Marketplace ist auf beiden Servern direkt ueber den konfigurierten Web-Port erreichbar.
- Beide Server verwenden dieselbe externe Datenbank und denselben Bildspeicher, sodass Anmeldungen und Daten erhalten bleiben.
- Die Ausfallsicherung ersetzt kein Backup; automatische Datenbank-Backups werden weiterhin benoetigt.