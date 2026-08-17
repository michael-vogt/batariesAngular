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

echo json_encode([
    'gueltig' => true,
    'name' => $gefundenerName,
    'berechtigungen' => $gefundeneRechte,
]);
