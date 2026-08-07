# Auf den Webserver bringen

Ziel: Die Angular-App liegt als statische Dateien neben der API auf demselben
Server. Dadurch entfällt CORS vollständig — die App ruft ihre eigene Herkunft auf.

## Zielstruktur auf dem Server

```
/www/htdocs/w005d352/
├── config.php                 ← API-Key + Pfad zum Datenverzeichnis
├── data/                      ← manifest.json, mitglieder.json, kegeljahre/, backups/
└── bataries/angular/
    ├── index.html             ← gebaute App
    ├── main-<hash>.js
    ├── styles-<hash>.css
    ├── .htaccess              ← app.htaccess aus diesem Ordner, umbenannt
    └── api/
        └── api.php
```

`config.php` und `data/` liegen weiterhin **oberhalb** des Webroots.

## 1. Bauen

```bash
ng build --configuration production --base-href /angular/
```

Der `--base-href` muss dem Unterordner entsprechen, in dem die App liegt.
Läge sie direkt in der Domainwurzel, wäre es `/`. Stimmt der Wert nicht,
lädt die Seite weiß, weil die Bundle-Pfade ins Leere zeigen.

Das Ergebnis liegt je nach Angular-Version in:
- `dist/<projektname>/browser/` (Angular 17 und neuer)
- `dist/<projektname>/` (älter)

## 2. Hochladen

Den **Inhalt** dieses Ordners (nicht den Ordner selbst) nach
`bataries/angular/` kopieren. Der Unterordner `api/` mit der `api.php`
bleibt dabei bestehen.

Anschließend `app.htaccess` aus diesem Verzeichnis als `.htaccess` in
`bataries/angular/` ablegen.

## 3. config.php anpassen

```php
'erlaubterOrigin' => '',
```

Leer lassen: App und API teilen sich jetzt den Ursprung, CORS-Header werden
nicht mehr gebraucht. Steht dort weiterhin `http://localhost:4200`, schadet
das nichts, ist aber überflüssig — es sei denn, du willst parallel weiter mit
`ng serve` entwickeln. Dann den Eintrag stehen lassen.

## 4. Verbindung in der App eintragen

Beim ersten Aufruf unter *Einstellungen* eintragen:

- **API-Adresse:** `api/api.php` (relativ, ohne führenden Schrägstrich)
- **API-Key:** der Wert aus `config.php`

Eine relative Adresse ist der absoluten vorzuziehen: sie funktioniert
unverändert weiter, falls die Domain sich einmal ändert.

## Prüfen, ob alles sitzt

| Test | Erwartung |
|---|---|
| `https://www.bataries.de/angular/` aufrufen | App lädt |
| Auf *Mitglieder* wechseln, dann F5 drücken | Seite lädt erneut, kein 404 |
| Netzwerk-Tab beim Speichern | `PUT api/api.php?pfad=…` liefert 204 |
| *Abrechnung* → PDF herunterladen | Nachladen des jsPDF-Bundles, dann Download |

Der zweite Test ist der wichtigste: Ein 404 nach dem Neuladen bedeutet, dass
die `.htaccess` nicht greift — dann entweder `RewriteBase` prüfen oder beim
Hoster nachsehen, ob `AllowOverride` für das Verzeichnis aktiv ist.

## Bei jedem weiteren Deployment

Alte `*.js`- und `*.css`-Dateien vorher löschen. Sie tragen Hashes im Namen,
werden also nicht überschrieben und sammeln sich sonst über die Zeit an.
