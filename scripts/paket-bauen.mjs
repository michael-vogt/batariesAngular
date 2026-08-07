import { createWriteStream, existsSync, readdirSync, statSync, copyFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

// archiver ist ein CommonJS-Paket ohne ESM-Default-Export und lässt sich
// daher nicht per import einbinden. Bis Version 7 war das Modul selbst
// aufrufbar, ab Version 8 exportiert es die Klasse Archiver — beides wird
// unterstützt, damit das Skript nicht an einer Versionsanhebung scheitert.
const archiverModul = createRequire(import.meta.url)('archiver');
const erzeugeArchiv = optionen => {
  // Version 8: ZipArchive ist die formatgebundene Klasse (Archiver allein
  // ist die abstrakte Basis und liefert beim Abschluss einen Fehler).
  if (typeof archiverModul.ZipArchive === 'function') return new archiverModul.ZipArchive(optionen);
  // Version 7 und älter: das Modul selbst ist aufrufbar.
  if (typeof archiverModul === 'function') return archiverModul('zip', optionen);
  throw new Error('archiver: unbekannte Modulstruktur — bitte Version prüfen.');
};

/**
 * Packt die gebaute App zusammen mit der .htaccess in ein ZIP-Archiv,
 * das sich unverändert auf den Webserver entpacken lässt.
 *
 * Aufruf über `npm run paket` (baut vorher automatisch).
 */

const wurzel = resolve(import.meta.dirname, '..');
const distWurzel = join(wurzel, 'dist');

/** Findet den Ordner mit der index.html — der Pfad unterscheidet sich je nach Angular-Version. */
function findeBuildOrdner() {
  if (!existsSync(distWurzel)) {
    throw new Error('Kein dist/-Ordner gefunden. Zuerst bauen: ng build --configuration production');
  }

  const kandidaten = [];
  for (const projekt of readdirSync(distWurzel)) {
    const basis = join(distWurzel, projekt);
    if (!statSync(basis).isDirectory()) continue;

    // Angular 17+: dist/<projekt>/browser/, davor: dist/<projekt>/
    for (const pfad of [join(basis, 'browser'), basis]) {
      if (existsSync(join(pfad, 'index.html'))) {
        kandidaten.push(pfad);
        break;
      }
    }
  }

  if (kandidaten.length === 0) throw new Error('Keine index.html unter dist/ gefunden.');
  if (kandidaten.length > 1) {
    console.warn(`Mehrere Builds gefunden, nehme: ${kandidaten[0]}`);
  }
  return kandidaten[0];
}

/**
 * Prüft den base-href. Unter Git Bash wandelt MSYS "/angular/" still in
 * einen Windows-Pfad um — das Ergebnis lädt im Browser nicht und fällt
 * sonst erst nach dem Hochladen auf.
 */
function pruefeBaseHref(buildOrdner) {
  const html = readFileSync(join(buildOrdner, 'index.html'), 'utf8');
  const treffer = html.match(/<base href="([^"]*)"/);

  if (!treffer) {
    console.warn('Warnung: kein <base href> in der index.html gefunden.');
    return;
  }

  const wert = treffer[1];
  console.log(`  base href: ${wert}`);

  if (/^[A-Za-z]:/.test(wert) || wert.includes('Program Files')) {
    throw new Error(
      `Ungültiger base-href "${wert}". Ursache ist meist die Pfadumwandlung von Git Bash — ` +
        `den Wert besser in angular.json unter "baseHref" eintragen statt als Kommandozeilenargument.`,
    );
  }
}

function paketBauen() {
  const buildOrdner = findeBuildOrdner();
  console.log(`Build gefunden: ${buildOrdner}`);
  pruefeBaseHref(buildOrdner);

  // .htaccess mit einpacken, damit nach dem Entpacken nichts fehlt
  // Mehrere übliche Ablageorte prüfen, damit es nicht an einer
  // Ordnerkonvention scheitert.
  const htaccessKandidaten = [
    join(wurzel, 'deployment', 'app.htaccess'),
    join(wurzel, 'deployment', '.htaccess'),
    join(wurzel, 'public', '.htaccess'),
    join(wurzel, 'src', '.htaccess'),
  ];
  const htaccessQuelle = htaccessKandidaten.find(pfad => existsSync(pfad));

  if (!htaccessQuelle) {
    // Bewusst ein Abbruch, keine Warnung: ohne .htaccess funktioniert das
    // Neuladen einer Unterseite auf dem Server nicht, und eine Warnung
    // zwischen den Build-Ausgaben übersieht man zu leicht.
    throw new Error(
      'Keine .htaccess gefunden. Erwartet an einem dieser Orte:\n  ' +
        htaccessKandidaten.map(p => p.replace(wurzel + '/', '')).join('\n  ') +
        '\nDie Datei app.htaccess aus der Anleitung dort ablegen.',
    );
  }

  copyFileSync(htaccessQuelle, join(buildOrdner, '.htaccess'));
  console.log(`  .htaccess übernommen aus ${htaccessQuelle.replace(wurzel + '/', '')}`);

  const datum = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const zielOrdner = join(wurzel, 'releases');
  if (!existsSync(zielOrdner)) mkdirSync(zielOrdner);
  const ziel = join(zielOrdner, `kegelverein-${datum}.zip`);

  const ausgabe = createWriteStream(ziel);
  const archiv = erzeugeArchiv({ zlib: { level: 9 } });

  // Mitzählen, was tatsächlich ins Archiv geht — so ist ohne Nachsehen
  // erkennbar, ob z.B. die .htaccess enthalten ist.
  const aufgenommen = [];
  archiv.on('entry', eintrag => aufgenommen.push(eintrag.name));

  ausgabe.on('close', () => {
    const mb = (archiv.pointer() / 1024 / 1024).toFixed(2);
    console.log(`\nFertig: ${ziel} (${mb} MB, ${aufgenommen.length} Einträge)`);

    const htaccessDrin = aufgenommen.some(name => name === '.htaccess');
    console.log(`  .htaccess im Archiv: ${htaccessDrin ? 'ja' : 'NEIN — bitte prüfen'}`);
    console.log(`  index.html im Archiv: ${aufgenommen.includes('index.html') ? 'ja' : 'NEIN'}`);
    console.log('\nInhalt direkt in den Zielordner auf dem Server entpacken.');
  });

  archiv.on('warning', fehler => console.warn(fehler));
  archiv.on('error', fehler => {
  throw fehler;
  });

  archiv.pipe(ausgabe);
  // Quellkarten bleiben draußen: sie legen den Quelltext offen und blähen das Archiv auf.
  archiv.glob('**/*', { cwd: buildOrdner, dot: true, ignore: ['**/*.map'] });
  archiv.finalize();
}

try {
  paketBauen();
} catch (fehler) {
  // Nur die Meldung, kein Stacktrace: die Fehler hier sind Bedienfehler
  // (falscher base-href, fehlender Build), keine Programmabstürze.
  console.error(`\nAbbruch: ${fehler instanceof Error ? fehler.message : fehler}`);
  process.exit(1);
}
