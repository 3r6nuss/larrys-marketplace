# Larrys hochverfuegbar auf Main-Server und Raspberry Pi

## Zielbild

Beide Rechner betreiben Frontend und API. Sie speichern selbst keine produktiven
Daten mehr. Stattdessen verwenden beide dieselbe verwaltete PostgreSQL-Datenbank,
denselben S3-kompatiblen Bildspeicher und denselben Cloudflare Tunnel.

```mermaid
flowchart LR
  U[Benutzer] --> C[Cloudflare Edge]
  C -->|Tunnel-Verbindung A| M[Main: Web + API]
  C -->|Tunnel-Verbindung B| P[Pi: Web + API]
  M --> D[(Managed PostgreSQL)]
  P --> D
  M --> O[(R2 / S3 Bilder)]
  P --> O
```

Bei einem kompletten Host-Ausfall verliert Cloudflare dessen Tunnel-Verbindungen
und verwendet die verbleibende Verbindung. Weil Sessions in PostgreSQL liegen,
bleiben Benutzer angemeldet. Fuer einen Host-Ausfall ist der RPO praktisch null;
der RTO liegt normalerweise im Sekundenbereich.

Das ist Active-Active, nicht ein ungenutzter Cold-Standby. Ein echtes
Primary/Standby-Routing benoetigt zwei getrennte Tunnel und einen Cloudflare Load
Balancer. Fuer Larrys ist Active-Active einfacher und testet den Pi fortlaufend.
Cloudflare dokumentiert dieses Verfahren als
[Tunnel availability and failover](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/).

## Wichtige Grenze

Hochverfuegbarkeit ist kein Backup. Dieses Setup schuetzt vor dem Ausfall des
Main-Servers. Es schuetzt nicht vor versehentlichem Loeschen, kompromittierten
Zugangsdaten oder einem Ausfall des Datenbank-/Storage-Anbieters. Aktiviere beim
PostgreSQL-Anbieter Point-in-Time-Recovery und sichere regelmaessig einen `pg_dump`
bei einem dritten Ziel.

Ein PostgreSQL-Primary auf dem Main-Server und nur ein Replica auf dem Pi ist hier
nicht empfehlenswert: Zwei Knoten haben bei einer Netztrennung kein sicheres
Quorum und koennen Split-Brain erzeugen. Eine verwaltete Datenbank ausserhalb
beider Hosts beseitigt diesen Fehlerpunkt sauber.

## Voraussetzungen

- Eine Domain in Cloudflare
- Verwaltetes PostgreSQL ausserhalb beider Hosts, mit Backups/PITR
- Cloudflare R2 oder ein anderer S3-kompatibler, oeffentlich lesbarer Bildspeicher
- Docker Compose und Git auf beiden Hosts
- Raspberry Pi mit 64-Bit-OS, Ethernet und moeglichst SSD statt SD-Karte
- Idealerweise eine USV fuer Pi, Router und Switch

Auf dem Router sind keine Portfreigaben erforderlich. Der Tunnel baut ausgehend
eine verschluesselte Verbindung auf und funktioniert auch bei wechselnder
oeffentlicher IP oder CGNAT.

Main-Server und Pi sollten nicht dieselbe Stromversorgung und denselben
Internetanschluss nutzen. Stehen beide hinter demselben Router, bleibt dieser
Router samt ISP ein gemeinsamer Single Point of Failure.

## 1. PostgreSQL vorbereiten

Erstelle eine leere PostgreSQL-16-Datenbank. Verwende TLS und notiere die
Connection-URL. Bereite Datenbank, R2, Tunnel und `ha.env` vollstaendig vor, bevor
das Wartungsfenster beginnt. Stoppe beim eigentlichen Cutover zuerst alle
Schreibzugriffe; die lokale Datenbank bleibt fuer den Dump aktiv:

```powershell
docker compose stop larrys-marketplace larrys-api
docker compose exec larrys-db pg_dump -U larrys -d larrys -Fc -f /tmp/larrys.dump
docker cp larrys-db:/tmp/larrys.dump .\larrys.dump
```

Setze die Ziel-URL nur fuer das aktuelle PowerShell-Fenster und importiere sie:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORT@HOST:5432/larrys?sslmode=require'
docker run --rm --env DATABASE_URL="$env:DATABASE_URL" -v "${PWD}/larrys.dump:/backup/larrys.dump:ro" postgres:16-alpine sh -c 'pg_restore --no-owner --no-acl --dbname="$DATABASE_URL" /backup/larrys.dump'
Remove-Item Env:DATABASE_URL
```

Fuehre den Import vor dem ersten HA-Start durch. Bei einer nicht leeren
Zieldatenbank zuerst eine frische Datenbank anlegen, statt Tabellen teilweise zu
ueberschreiben. Starte die alte API nach dem Dump nicht wieder, ausser du brichst
den Cutover bewusst ab; sonst entstehen nachtraegliche Aenderungen nur noch in
der alten Datenbank.

## 2. R2-Bildspeicher vorbereiten

1. Erstelle einen privaten R2-Bucket, zum Beispiel `larrys-images`.
2. Verbinde eine oeffentliche Custom Domain, zum Beispiel `media.example.com`.
3. Erstelle einen API-Token mit Object Read & Write nur fuer diesen Bucket.
4. Trage Endpoint, Bucket, Zugangsdaten und Custom Domain in `ha.env` ein.

Der Browser liest Bilder ueber die Custom Domain. Nur die beiden APIs erhalten
Schreibrechte. Verwende nicht die S3-Zugangsschluessel im Frontend.

Migriere vorhandene Dateien erst auf dem Main-Server. Das Compose-Projekt heisst
weiterhin `larrys`. Ermittle trotzdem den tatsaechlichen Namen des vorhandenen
Upload-Volumes, weil Portainer einen abweichenden Stacknamen verwendet haben kann:

```powershell
docker inspect larrys-api --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}'
```

Trage die Ausgabe als `UPLOADS_VOLUME` in `ha.env` ein. Auf dem Pi darf unter
diesem Namen ein neues leeres Volume entstehen. Fuehre danach die Migration nur
auf dem Main-Server aus:

```powershell
Copy-Item ha.env.example ha.env
# ha.env jetzt mit echten Werten ausfuellen
docker compose --env-file ha.env -f docker-compose.ha.yml build larrys-api
docker compose --env-file ha.env -f docker-compose.ha.yml run --rm larrys-api npm run images:migrate-s3
```

Das Skript laedt Dateien idempotent hoch, aktualisiert danach die Bildpfade in
PostgreSQL und behaelt lokale Dateien als Rollback-Kopie. Kontrolliere mehrere
Bilder ueber die neue Media-Domain, bevor du alte lokale Dateien entfernst. Falls
noch Datenbankpfade ohne passende Datei im Volume existieren, bricht das Skript
ab; repariere oder entferne diese Verweise vor dem HA-Start.

## 3. Cloudflare Tunnel einrichten

1. Erstelle in Cloudflare Zero Trust genau einen remotely managed Tunnel namens
   `larrys-ha`.
2. Lege einen Public Hostname an, zum Beispiel `larrys.example.com`.
3. Setze den Service auf `http://larrys-marketplace:80`.
4. Kopiere denselben Tunnel-Token in die `ha.env` beider Hosts.
5. Hinterlege bei Discord exakt
   `https://larrys.example.com/api/auth/discord/callback` als Redirect-URL.

Der Service-Name wird in jedem lokalen Docker-Netz aufgeloest. Beide
`cloudflared`-Container duerfen daher denselben Tunnel und dieselbe Konfiguration
verwenden. Das HA-Compose veroeffentlicht keine Host-Ports; die konfigurierte
Proxy-Vertrauenskette gilt deshalb nur innerhalb dieses isolierten Docker-Netzes.

Tunnel-Replikate erkennen einen ausgefallenen Host beziehungsweise Connector.
Sie pruefen aber nicht proaktiv, ob eine noch laufende Origin-Anwendung korrekte
HTTP-Antworten liefert. Wer auch bei einem isolierten API-/Nginx-Defekt garantiert
umschalten will, verwendet zwei getrennte Tunnel und einen Cloudflare Load
Balancer mit `/readyz` als Healthcheck.

## 4. Beide Hosts starten

Checke auf Main und Pi denselben Git-Commit aus. Lege auf beiden Hosts eine
identische `ha.env` an. `PUBLIC_URL` darf keinen abschliessenden Slash enthalten;
`SESSION_SECRET` muss auf beiden Hosts exakt gleich und mindestens 32 Zeichen lang
sein.

```bash
docker compose --env-file ha.env -f docker-compose.ha.yml up -d --build
docker compose --env-file ha.env -f docker-compose.ha.yml ps
docker compose --env-file ha.env -f docker-compose.ha.yml exec larrys-marketplace wget -qO- http://127.0.0.1/readyz
```

Die Ausgabe des letzten Befehls muss `status: ready` und `postgresql` enthalten.
Im Cloudflare-Dashboard muessen zwei gesunde Connectoren mit unterschiedlichen
Quellnetzen erscheinen.

## 5. Failover wirklich testen

1. Melde dich an, erstelle einen Testeintrag und oeffne dessen Bild.
2. Schalte den Main-Server komplett aus oder stoppe dort alle drei Dienste.
3. Rufe von einem dritten Anschluss wiederholt
   `https://larrys.example.com/api/ready` auf.
4. Lade die Seite im bestehenden Browser neu. Login, Datensatz und Bild muessen
   erhalten bleiben.
5. Starte den Main-Server wieder und kontrolliere beide Connectoren.

Nur den API-Container zu stoppen ist kein vollstaendiger Tunnel-Ausfall. Fuer den
Abnahmetest den Host oder mindestens `cloudflared` mit stoppen:

```bash
docker compose --env-file ha.env -f docker-compose.ha.yml stop cloudflared larrys-marketplace larrys-api
```

## Betrieb

- Ueberwache `/api/ready` von einem externen Monitoring-Dienst im Minutentakt.
- Alarmiere bei nur einem Cloudflare-Connector, nicht erst bei Totalausfall.
- Spiele Updates nacheinander ein: Tunnel eines Hosts stoppen, aktualisieren,
  `/readyz` testen, Tunnel starten, dann den zweiten Host aktualisieren.
- Sichere PostgreSQL automatisiert und teste die Wiederherstellung regelmaessig.
- Bewahre `ha.env` nie in Git auf und rotiere Tokens nach einem Verdacht.
- Nutze auf dem Pi SSD, Ethernet und eine USV; die SD-Karte ist kein verlaessliches
  Produktionsmedium.