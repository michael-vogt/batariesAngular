<?php
declare(strict_types=1);

/**
 * Einziger Endpunkt für den PhpApiAdapter (Angular-Seite).
 * Diese Datei liegt im Webroot, config.php + data/ liegen eine Ebene darüber.
 *
 * Aufrufe:
 *   GET    api.php?pfad=manifest.json
 *   GET    api.php?pfad=kegeljahre/2025-2026.json
 *   GET    api.php?liste=backups
 *   PUT    api.php?pfad=kegeljahre/2025-2026.json   (Body = JSON-Inhalt)
 *   DELETE api.php?pfad=backups/xyz.json
 */

// ---------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------

$config = require __DIR__ . '/../config.php';
$dataDir = rtrim((string) $config['dataDir'], '/');
$apiKey = (string) $config['apiKey'];
$erlaubterOrigin = (string) ($config['erlaubterOrigin'] ?? '');

// ---------------------------------------------------------------
// CORS
// ---------------------------------------------------------------

if ($erlaubterOrigin !== '') {
    header("Access-Control-Allow-Origin: {$erlaubterOrigin}");
}
header('Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: X-Api-Key, Content-Type');
header('Vary: Origin');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ---------------------------------------------------------------
// Authentifizierung
// ---------------------------------------------------------------

$providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey === 'HIER_LANGEN_ZUFAELLIGEN_STRING_EINSETZEN' || !hash_equals($apiKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Ungültiger oder fehlender API-Key']);
    exit;
}

// ---------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------

/**
 * Löst einen relativen Pfad sicher gegen $dataDir auf. Verhindert
 * Path-Traversal (../), erzwingt .json-Endung und ein enges Zeichen-Set.
 */
function sicherenPfadAufloesen(string $dataDir, string $relativerPfad): string
{
    if ($relativerPfad === '' || str_contains($relativerPfad, '..') || str_starts_with($relativerPfad, '/')) {
        throw new InvalidArgumentException('Ungültiger Pfad');
    }
    if (!preg_match('#^[A-Za-z0-9_\-./]+\.json$#', $relativerPfad)) {
        throw new InvalidArgumentException('Ungültiger Dateiname');
    }

    $absolut = $dataDir . '/' . $relativerPfad;
    $elternRealpath = realpath(dirname($absolut));
    $dataDirRealpath = realpath($dataDir);

    // Bei PUT existiert der Zielordner evtl. noch nicht -> erst anlegen, dann erneut prüfen.
    if ($elternRealpath === false) {
        mkdir(dirname($absolut), 0775, true);
        $elternRealpath = realpath(dirname($absolut));
    }

    if ($dataDirRealpath === false || $elternRealpath === false || !str_starts_with($elternRealpath, $dataDirRealpath)) {
        throw new InvalidArgumentException('Pfad außerhalb des Datenverzeichnisses');
    }

    return $absolut;
}

function ordnerAuflisten(string $dataDir, string $relativerOrdner): array
{
    if (str_contains($relativerOrdner, '..') || str_starts_with($relativerOrdner, '/')) {
        throw new InvalidArgumentException('Ungültiger Ordner');
    }
    $absolut = $dataDir . '/' . ltrim($relativerOrdner, '/');
    if (!is_dir($absolut)) {
        return [];
    }
    $eintraege = scandir($absolut) ?: [];
    return array_values(array_filter($eintraege, fn(string $n) => str_ends_with($n, '.json')));
}

/** Schreibt atomar: erst in temp-Datei im selben Verzeichnis, dann rename() (auf demselben Dateisystem atomar). */
function atomarSchreiben(string $zielpfad, string $inhalt): void
{
    $tempDatei = $zielpfad . '.tmp.' . bin2hex(random_bytes(4));
    $handle = fopen($tempDatei, 'w');
    if ($handle === false) {
        throw new RuntimeException('Konnte temporäre Datei nicht öffnen');
    }
    flock($handle, LOCK_EX);
    fwrite($handle, $inhalt);
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    if (!rename($tempDatei, $zielpfad)) {
        @unlink($tempDatei);
        throw new RuntimeException('Konnte Datei nicht ersetzen');
    }
}

// ---------------------------------------------------------------
// Routing
// ---------------------------------------------------------------

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB, großzügig für den Anwendungsfall

try {
    if (isset($_GET['liste'])) {
        echo json_encode(ordnerAuflisten($dataDir, (string) $_GET['liste']));
        exit;
    }

    $pfad = (string) ($_GET['pfad'] ?? '');
    $methode = $_SERVER['REQUEST_METHOD'] ?? '';

    switch ($methode) {
        case 'GET':
            $absolutePfad = sicherenPfadAufloesen($dataDir, $pfad);
            if (!is_file($absolutePfad)) {
                http_response_code(404);
                echo json_encode(['error' => 'Datei nicht gefunden']);
                exit;
            }
            readfile($absolutePfad);
            break;

        case 'PUT':
            $absolutePfad = sicherenPfadAufloesen($dataDir, $pfad);
            $inhalt = file_get_contents('php://input');
            if ($inhalt === false || strlen($inhalt) > MAX_BODY_BYTES) {
                throw new InvalidArgumentException('Ungültiger oder zu großer Inhalt');
            }
            // Syntax-Check: wirft JsonException bei ungültigem JSON statt still zu speichern.
            json_decode($inhalt, true, 512, JSON_THROW_ON_ERROR);

            atomarSchreiben($absolutePfad, $inhalt);
            http_response_code(204);
            break;

        case 'DELETE':
            $absolutePfad = sicherenPfadAufloesen($dataDir, $pfad);
            if (is_file($absolutePfad)) {
                unlink($absolutePfad);
            }
            http_response_code(204);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Methode nicht erlaubt']);
    }
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (JsonException $e) {
    http_response_code(400);
    echo json_encode(['error' => 'Ungültiges JSON: ' . $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Serverfehler']);
}
