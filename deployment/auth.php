<?php
declare(strict_types=1);

/**
 * Prüft eine Rolle samt Zugangsdaten.
 *
 * Bewusst ein eigener Endpunkt neben api.php: Dort geht es um Dateizugriff,
 * hier um eine Prüfung. Die Rollendatei liegt außerhalb des
 * Datenverzeichnisses und ist deshalb über api.php nicht abrufbar — sonst
 * wären die Hashes öffentlich.
 *
 * Aufrufe:
 *   POST auth.php                 Body: {"name": "...", "credential": "..."}
 *     -> 200 {"gueltig": true, "name": "...", "berechtigungen": {...}}
 *     -> 401 {"gueltig": false}
 *
 *   GET  auth.php?aktion=rollen   nur die Namen, für eine Auswahlliste
 *     -> 200 {"rollen": ["Kassenwart", "Mitglied"]}
 *
 *   POST auth.php?aktion=rollen   Body wie oben, mit gültigen Zugangsdaten
 *     -> 200 {"rollen": [{"name": "...", "berechtigungen": {...}}, ...]}
 *     -> 403, wenn die Rolle dafür nicht berechtigt ist
 *
 *   POST auth.php?aktion=rolle-anlegen
 *     Body: {"name","credential","neueRolle":{"name","passwort","berechtigungen"}}
 *     -> 201 {"angelegt": true, "name": "..."}
 *     -> 403 ohne Verwaltungsrecht, 409 bei vergebenem Namen
 *
 *   POST auth.php?aktion=rolle-aendern
 *     Body: {"name","credential","rolle":{"name","neuerName?","passwort?","berechtigungen?"}}
 *     -> 200 {"geaendert": true, "name": "..."}
 *
 *   POST auth.php?aktion=rolle-loeschen
 *     Body: {"name","credential","rolle":{"name"}}
 *     -> 200 {"geloescht": true, "name": "..."}
 *
 * Hashes verlassen den Server unter keinen Umständen.
 *
 * Was dieser Endpunkt NICHT tut: eine Sitzung eröffnen oder ein Token
 * ausstellen. Er beantwortet allein die Frage, ob Name und Zugangsdaten
 * zusammenpassen.
 */

/**
 * Berechtigungen, die es gibt.
 *
 * Die Liste dient allein dazu, Tippfehler in rollen.json aufzudecken: Ein
 * verschriebener Name würde sonst stillschweigend keine Berechtigung
 * ergeben, und niemand käme darauf, warum. Beim Ergänzen einer neuen
 * Berechtigung ist sie hier einzutragen.
 */
const BEKANNTE_BERECHTIGUNGEN = ['verwaltung', 'terminplanung', 'termineAbmelden'];

$config = require __DIR__ . '/../config.php';
$apiKey = (string) $config['apiKey'];
$erlaubterOrigin = (string) ($config['erlaubterOrigin'] ?? '');
$rollenDatei = (string) ($config['rollenDatei'] ?? __DIR__ . '/../rollen.json');

// ---------------------------------------------------------------
// CORS
// ---------------------------------------------------------------

if ($erlaubterOrigin !== '') {
    header("Access-Control-Allow-Origin: {$erlaubterOrigin}");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: X-Api-Key, Content-Type');
header('Vary: Origin');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
// Antworten dieses Endpunkts dürfen nirgends zwischengespeichert werden.
header('Cache-Control: no-store');

// ---------------------------------------------------------------
// Zugang zum Endpunkt selbst
// ---------------------------------------------------------------

$providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey === 'HIER_LANGEN_ZUFAELLIGEN_STRING_EINSETZEN' || !hash_equals($apiKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Ungültiger oder fehlender API-Key']);
    exit;
}

$methode = $_SERVER['REQUEST_METHOD'] ?? '';
$aktion = (string) ($_GET['aktion'] ?? '');

if ($methode !== 'POST' && !($methode === 'GET' && $aktion === 'rollen')) {
    http_response_code(405);
    echo json_encode(['error' => 'Nur POST erlaubt (Ausnahme: GET ?aktion=rollen)']);
    exit;
}

// ---------------------------------------------------------------
// Prüfung
// ---------------------------------------------------------------

/**
 * Verzögert jede Antwort um etwa eine Viertelsekunde.
 *
 * Das bremst automatisiertes Durchprobieren spürbar aus, ohne die
 * Bedienung zu stören. Die Verzögerung gilt auch im Erfolgsfall, damit
 * sich aus der Antwortzeit nicht ablesen lässt, ob ein Name existiert.
 */
function verzoegern(): void
{
    usleep(250_000);
}

$eingabe = $methode === 'POST' ? json_decode((string) file_get_contents('php://input'), true) : null;
$name = is_array($eingabe) ? (string) ($eingabe['name'] ?? '') : '';
$credential = is_array($eingabe) ? (string) ($eingabe['credential'] ?? '') : '';

if ($methode === 'POST' && ($name === '' || $credential === '')) {
    verzoegern();
    http_response_code(400);
    echo json_encode(['error' => 'Name und Zugangsdaten sind erforderlich']);
    exit;
}

if (!is_readable($rollenDatei)) {
    // Kein Hinweis auf den Dateipfad in der Antwort — das ginge niemanden
    // etwas an, der hier anfragt.
    error_log("auth.php: Rollendatei nicht lesbar: {$rollenDatei}");
    verzoegern();
    http_response_code(500);
    echo json_encode(['error' => 'Rollen sind nicht verfügbar']);
    exit;
}

try {
    $rollenDaten = json_decode((string) file_get_contents($rollenDatei), true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    error_log('auth.php: Rollendatei ist kein gültiges JSON: ' . $e->getMessage());
    verzoegern();
    http_response_code(500);
    echo json_encode(['error' => 'Rollen sind nicht verfügbar']);
    exit;
}

// Ältere Dateien ohne Berechtigungen bleiben lesbar: dort gilt schlicht
// nichts als erteilt. Eine unbekannte Version deutet dagegen darauf hin,
// dass die Datei neuer ist als dieser Endpunkt.
$version = $rollenDaten['schemaVersion'] ?? 1;
if (!in_array($version, [1, 2], true)) {
    error_log("auth.php: Unbekannte schemaVersion {$version} in der Rollendatei.");
}

$rollen = $rollenDaten['rollen'] ?? null;

if (!is_array($rollen)) {
    // Häufigster Fehler beim Einrichten: die Datei enthält das Array
    // direkt statt eines Objekts mit dem Feld "rollen". Ohne diesen
    // Hinweis wäre das nicht von einem falschen Passwort zu unterscheiden.
    error_log(
        'auth.php: In der Rollendatei fehlt das Feld "rollen". '
        . 'Erwartet wird {"schemaVersion":1,"rollen":[...]}, gefunden: '
        . (array_is_list($rollenDaten ?? []) ? 'ein Array ohne Umhüllung' : 'etwas anderes')
    );
    verzoegern();
    http_response_code(500);
    echo json_encode(['error' => 'Rollen sind nicht verfügbar']);
    exit;
}

if ($rollen === []) {
    error_log('auth.php: Die Rollendatei enthält keine Einträge.');
}

/**
 * Stufe 1: nur die Namen.
 *
 * Rollennamen sind keine Geheimnisse — sie stehen auf jeder Einladung zur
 * Generalversammlung. Für eine Auswahlliste beim Anmelden ist das die
 * angemessene Auskunft: Sie erspart das fehleranfällige Abtippen, ohne zu
 * verraten, was eine Rolle darf oder wie ihre Zugangsdaten lauten.
 *
 * Dass damit die Namen bekannt sind, nimmt der Zeitgleichheit beim
 * Prüfen (siehe unten) ihren Zweck teilweise. Das ist vertretbar: Der
 * Schutz liegt im Passwort, nicht in der Verborgenheit des Namens.
 */
if ($methode === 'GET' && $aktion === 'rollen') {
    $namen = [];
    foreach ($rollen as $rolle) {
        if (isset($rolle['name'])) {
            $namen[] = (string) $rolle['name'];
        }
    }
    echo json_encode(['rollen' => $namen]);
    exit;
}

/**
 * Bringt die Berechtigungen einer Rolle in eine feste Form.
 *
 * Jede bekannte Berechtigung kommt vor — fehlt sie in der Datei, gilt sie
 * als nicht erteilt. Dadurch muss die Gegenseite nicht zwischen "false"
 * und "gar nicht eingetragen" unterscheiden.
 *
 * Unbekannte Schlüssel werden verworfen und protokolliert; sie sind fast
 * immer ein Tippfehler.
 */
function berechtigungenLesen(array $rolle, string $rollenname): array
{
    $eingetragen = is_array($rolle['berechtigungen'] ?? null) ? $rolle['berechtigungen'] : [];

    foreach (array_keys($eingetragen) as $schluessel) {
        if (!in_array($schluessel, BEKANNTE_BERECHTIGUNGEN, true)) {
            error_log(
                "auth.php: Rolle \"{$rollenname}\" hat die unbekannte Berechtigung "
                . "\"{$schluessel}\" — Tippfehler? Bekannt sind: "
                . implode(', ', BEKANNTE_BERECHTIGUNGEN)
            );
        }
    }

    $ergebnis = [];
    foreach (BEKANNTE_BERECHTIGUNGEN as $recht) {
        $ergebnis[$recht] = ($eingetragen[$recht] ?? false) === true;
    }
    return $ergebnis;
}

$gefundenerHash = null;
$gefundenerName = null;
$gefundeneRechte = [];

foreach ($rollen as $rolle) {
    // Rollennamen ohne Rücksicht auf Groß-/Kleinschreibung vergleichen —
    // beim Anmelden tippt niemand exakt.
    if (isset($rolle['name']) && strcasecmp((string) $rolle['name'], $name) === 0) {
        $gefundenerHash = (string) ($rolle['hash'] ?? '');
        $gefundenerName = (string) $rolle['name'];
        $gefundeneRechte = berechtigungenLesen($rolle, $gefundenerName);
        break;
    }
}

/**
 * Auch bei unbekanntem Namen wird ein Hash geprüft.
 *
 * Sonst wäre die Antwort bei unbekannten Namen messbar schneller, und
 * damit ließe sich herausfinden, welche Rollen es gibt. Der Platzhalter
 * ist ein gültiger bcrypt-Hash, der zu keinem sinnvollen Passwort passt.
 */
$zuPruefen = $gefundenerHash !== null && $gefundenerHash !== ''
    ? $gefundenerHash
    : '$2y$12$........................................................';

$stimmt = password_verify($credential, $zuPruefen) && $gefundenerHash !== null;

verzoegern();

if (!$stimmt) {
    http_response_code(401);
    echo json_encode(['gueltig' => false]);
    exit;
}

/**
 * Stufe 2: Namen samt Berechtigungen.
 *
 * Wer welche Rechte hat, verrät, welche Rolle sich für einen Angriff
 * lohnt. Diese Auskunft gibt es deshalb erst nach bestandener Prüfung und
 * nur für Rollen, die selbst Verwaltungsrechte haben — wer die Rechte
 * anderer einsehen will, muss sie auch vergeben dürfen.
 *
 * Hashes bleiben auch hier außen vor.
 */
if ($aktion === 'rollen') {
    if (!$gefundeneRechte['verwaltung']) {
        http_response_code(403);
        echo json_encode(['error' => 'Diese Rolle darf die Rollenliste nicht einsehen']);
        exit;
    }

    $liste = [];
    foreach ($rollen as $rolle) {
        if (!isset($rolle['name'])) {
            continue;
        }
        $liste[] = [
            'name' => (string) $rolle['name'],
            'berechtigungen' => berechtigungenLesen($rolle, (string) $rolle['name']),
        ];
    }

    echo json_encode(['rollen' => $liste]);
    exit;
}

/**
 * Schreibt die Rollendatei atomar: erst in eine temporäre Datei daneben,
 * dann per rename() ersetzen. Ein abgebrochener Schreibvorgang kann so
 * nicht die bestehende Datei zerstören — sonst käme niemand mehr hinein.
 */
function rollenSchreiben(string $pfad, array $daten): void
{
    $temp = $pfad . '.tmp.' . bin2hex(random_bytes(4));
    $inhalt = json_encode($daten, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($inhalt === false || file_put_contents($temp, $inhalt) === false) {
        throw new RuntimeException('Rollendatei konnte nicht geschrieben werden');
    }
    if (!rename($temp, $pfad)) {
        @unlink($temp);
        throw new RuntimeException('Rollendatei konnte nicht ersetzt werden');
    }
}

/** Position einer Rolle in der Liste; null, wenn es sie nicht gibt. */
function rolleFinden(array $rollen, string $name): ?int
{
    foreach ($rollen as $i => $r) {
        if (isset($r['name']) && strcasecmp((string) $r['name'], $name) === 0) {
            return $i;
        }
    }
    return null;
}

/**
 * Zählt die Rollen mit Verwaltungsrecht.
 *
 * Grundlage für die Sperre gegen Aussperren: Verlöre die letzte Rolle
 * mit Verwaltungsrecht dieses Recht oder würde gelöscht, käme niemand
 * mehr an die Rollenverwaltung — reparieren ließe sich das nur noch von
 * Hand auf dem Server.
 */
function anzahlVerwalter(array $rollen): int
{
    $anzahl = 0;
    foreach ($rollen as $r) {
        if ((($r['berechtigungen'] ?? [])['verwaltung'] ?? false) === true) {
            $anzahl++;
        }
    }
    return $anzahl;
}

/** Übernimmt nur bekannte Berechtigungen; unbekannte werden gemeldet. */
function rechteFiltern(array $roh, string $wofuer): array
{
    $gefiltert = [];
    foreach ($roh as $schluessel => $wert) {
        if (in_array($schluessel, BEKANNTE_BERECHTIGUNGEN, true)) {
            $gefiltert[$schluessel] = $wert === true;
        } else {
            error_log("auth.php: Unbekannte Berechtigung \"{$schluessel}\" bei \"{$wofuer}\" verworfen.");
        }
    }
    foreach (BEKANNTE_BERECHTIGUNGEN as $recht) {
        $gefiltert[$recht] = $gefiltert[$recht] ?? false;
    }
    return $gefiltert;
}

if ($aktion === 'rolle-anlegen') {
    if (!$gefundeneRechte['verwaltung']) {
        http_response_code(403);
        echo json_encode(['error' => 'Diese Rolle darf keine Rollen anlegen']);
        exit;
    }

    $neu = is_array($eingabe['neueRolle'] ?? null) ? $eingabe['neueRolle'] : [];
    $neuName = trim((string) ($neu['name'] ?? ''));
    $neuPasswort = (string) ($neu['passwort'] ?? '');
    $neuRechte = is_array($neu['berechtigungen'] ?? null) ? $neu['berechtigungen'] : [];

    if ($neuName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Der Rollenname fehlt']);
        exit;
    }
    if (strlen($neuPasswort) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Das Passwort muss mindestens 8 Zeichen haben']);
        exit;
    }

    // Namen ohne Rücksicht auf Groß-/Kleinschreibung vergleichen: Beim
    // Anmelden wird ebenso verglichen, zwei Rollen "Kassenwart" und
    // "kassenwart" wären also nicht auseinanderzuhalten.
    if (rolleFinden($rollen, $neuName) !== null) {
        http_response_code(409);
        echo json_encode(['error' => "Eine Rolle namens \"{$neuName}\" gibt es bereits"]);
        exit;
    }

    $gefiltert = rechteFiltern($neuRechte, $neuName);

    $rollenDaten['schemaVersion'] = 2;
    $rollenDaten['rollen'][] = [
        'name' => $neuName,
        'hash' => password_hash($neuPasswort, PASSWORD_BCRYPT, ['cost' => 12]),
        'berechtigungen' => $gefiltert,
    ];

    try {
        rollenSchreiben($rollenDatei, $rollenDaten);
    } catch (Throwable $e) {
        error_log('auth.php: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Die Rolle konnte nicht gespeichert werden']);
        exit;
    }

    error_log("auth.php: Rolle \"{$neuName}\" von \"{$gefundenerName}\" angelegt.");

    http_response_code(201);
    echo json_encode(['angelegt' => true, 'name' => $neuName]);
    exit;
}

if ($aktion === 'rolle-aendern' || $aktion === 'rolle-loeschen') {
    if (!$gefundeneRechte['verwaltung']) {
        http_response_code(403);
        echo json_encode(['error' => 'Diese Rolle darf keine Rollen bearbeiten']);
        exit;
    }

    $ziel = is_array($eingabe['rolle'] ?? null) ? $eingabe['rolle'] : [];
    $zielName = trim((string) ($ziel['name'] ?? ''));

    if ($zielName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Es fehlt die Angabe, welche Rolle gemeint ist']);
        exit;
    }

    $index = rolleFinden($rollen, $zielName);
    if ($index === null) {
        http_response_code(404);
        echo json_encode(['error' => "Eine Rolle namens \"{$zielName}\" gibt es nicht"]);
        exit;
    }

    $bisher = $rollen[$index];
    $hatteVerwaltung = (($bisher['berechtigungen'] ?? [])['verwaltung'] ?? false) === true;

    // ---------------- Löschen ----------------
    if ($aktion === 'rolle-loeschen') {
        if ($hatteVerwaltung && anzahlVerwalter($rollen) <= 1) {
            http_response_code(409);
            echo json_encode([
                'error' => 'Das ist die letzte Rolle mit Verwaltungsrecht — '
                    . 'ohne sie käme niemand mehr an die Rollenverwaltung.',
            ]);
            exit;
        }

        array_splice($rollen, $index, 1);
        $rollenDaten['rollen'] = $rollen;

        try {
            rollenSchreiben($rollenDatei, $rollenDaten);
        } catch (Throwable $e) {
            error_log('auth.php: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Die Rolle konnte nicht gelöscht werden']);
            exit;
        }

        error_log("auth.php: Rolle \"{$zielName}\" von \"{$gefundenerName}\" gelöscht.");
        echo json_encode(['geloescht' => true, 'name' => $zielName]);
        exit;
    }

    // ---------------- Ändern ----------------
    $geaendert = $bisher;

    // Umbenennen — der Name ist zugleich die Anmeldekennung.
    $neuerName = trim((string) ($ziel['neuerName'] ?? ''));
    if ($neuerName !== '' && strcasecmp($neuerName, $zielName) !== 0) {
        if (rolleFinden($rollen, $neuerName) !== null) {
            http_response_code(409);
            echo json_encode(['error' => "Eine Rolle namens \"{$neuerName}\" gibt es bereits"]);
            exit;
        }
        $geaendert['name'] = $neuerName;
    }

    // Passwort nur ersetzen, wenn eines übergeben wurde. Ein leeres Feld
    // bedeutet "unverändert" — sonst müsste man es bei jeder
    // Rechteänderung erneut eingeben.
    $neuesPasswort = (string) ($ziel['passwort'] ?? '');
    if ($neuesPasswort !== '') {
        if (strlen($neuesPasswort) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Das Passwort muss mindestens 8 Zeichen haben']);
            exit;
        }
        $geaendert['hash'] = password_hash($neuesPasswort, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    if (is_array($ziel['berechtigungen'] ?? null)) {
        $neueRechte = rechteFiltern($ziel['berechtigungen'], $zielName);

        // Sperre gegen Aussperren: Das Verwaltungsrecht der letzten Rolle,
        // die es hat, lässt sich nicht entziehen.
        if ($hatteVerwaltung && $neueRechte['verwaltung'] !== true && anzahlVerwalter($rollen) <= 1) {
            http_response_code(409);
            echo json_encode([
                'error' => 'Das ist die letzte Rolle mit Verwaltungsrecht — '
                    . 'es lässt sich ihr nicht entziehen.',
            ]);
            exit;
        }

        $geaendert['berechtigungen'] = $neueRechte;
    }

    $rollen[$index] = $geaendert;
    $rollenDaten['rollen'] = $rollen;
    $rollenDaten['schemaVersion'] = 2;

    try {
        rollenSchreiben($rollenDatei, $rollenDaten);
    } catch (Throwable $e) {
        error_log('auth.php: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Die Änderung konnte nicht gespeichert werden']);
        exit;
    }

    error_log("auth.php: Rolle \"{$zielName}\" von \"{$gefundenerName}\" geändert.");
    echo json_encode(['geaendert' => true, 'name' => $geaendert['name']]);
    exit;
}

echo json_encode([
    'gueltig' => true,
    'name' => $gefundenerName,
    'berechtigungen' => $gefundeneRechte,
]);
