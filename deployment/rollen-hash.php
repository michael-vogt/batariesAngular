<?php
declare(strict_types=1);

/**
 * Erzeugt einen Eintrag für rollen.json.
 *
 * Aufruf auf dem Server:
 *   php rollen-hash.php <Name> <Passwort>
 *
 * Die Ausgabe in das Feld "rollen" der Datei rollen.json übernehmen.
 * Passwörter werden nie im Klartext gespeichert — in der Datei steht
 * ausschließlich der bcrypt-Hash, aus dem sich das Passwort nicht
 * zurückrechnen lässt.
 *
 * Diese Datei gehört NICHT in den Webroot: Sie wird von Hand auf der
 * Kommandozeile aufgerufen und hat im Web nichts zu suchen.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$name = $argv[1] ?? '';
$passwort = $argv[2] ?? '';

if ($name === '' || $passwort === '') {
    fwrite(STDERR, "Aufruf: php rollen-hash.php <Name> <Passwort>\n");
    exit(1);
}

// strlen statt mb_strlen: Die mbstring-Erweiterung ist auf einfachen
// Webspaces nicht immer vorhanden. Für eine Mindestlänge genügt die
// Byte-Zählung — Umlaute zählen dabei doppelt, was hier unschädlich ist.
if (strlen($passwort) < 8) {
    fwrite(STDERR, "Das Passwort sollte mindestens 8 Zeichen haben.\n");
    exit(1);
}

// cost 12 statt des Standards 10: spürbar langsamer zu berechnen, was
// Durchprobieren erschwert, für einen einzelnen Anmeldevorgang aber
// weiterhin unmerklich.
$hash = password_hash($passwort, PASSWORD_BCRYPT, ['cost' => 12]);

echo "Eintrag für rollen.json:\n\n";
echo json_encode(
    ['name' => $name, 'hash' => $hash],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
), "\n";
