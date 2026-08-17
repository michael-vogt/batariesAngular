<?php
/**
 * WICHTIG: Diese Datei gehört NICHT in den öffentlichen Webroot
 * (also nicht neben api.php in public_html/), sondern eine Ebene darüber,
 * z.B.:
 *
 *   /home/deinuser/config.php          <- diese Datei
 *   /home/deinuser/data/               <- Vereinsdaten
 *   /home/deinuser/public_html/api.php <- öffentlich erreichbar
 *
 * So kann niemand config.php oder die Datendateien direkt per URL abrufen,
 * selbst wenn die .htaccess-Regeln aus irgendeinem Grund nicht greifen.
 *
 * apiKey: langen, zufälligen String erzeugen, z.B. per Terminal:
 *   php -r "echo bin2hex(random_bytes(32));"
 */

return [
    'apiKey' => '369763d293676977b6a9ab9efc992d8530807912dd34f070b22f0fac2c3633e4',
    'dataDir' => __DIR__ . '/data',
    // Rollen für die Anmeldung. Bewusst NICHT unter dataDir: api.php kann
    // jede .json-Datei dort ausliefern, die Hashes wären damit abrufbar.
    'rollenDatei' => __DIR__ . '/rollen.json',
    // Nur nötig, falls Angular während der Entwicklung von einem anderen
    // Origin läuft (z.B. http://localhost:4200). In Produktion auf die
    // tatsächliche Domain der Angular-App einschränken, NICHT '*' lassen.
    'erlaubterOrigin' => 'http://localhost:4200',
];
