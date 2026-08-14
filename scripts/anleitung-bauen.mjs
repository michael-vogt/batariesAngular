import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Erzeugt das Template der Anleitungsseite aus BEDIENUNG.md.
 *
 * Damit gibt es genau eine Quelle für den Text: die Markdown-Datei. Die
 * Seite in der Anwendung wird daraus abgeleitet und nie von Hand
 * bearbeitet — sonst laufen beide Fassungen auseinander.
 *
 * Aufruf: npm run anleitung
 * Voraussetzung: npm install --save-dev marked
 *
 * (marked ist ein CommonJS-freundliches Paket; der Umweg über
 * createRequire vermeidet Unterschiede zwischen den Versionen.)
 */

const require = createRequire(import.meta.url);

const wurzel = resolve(import.meta.dirname, '..');
const quelle = join(wurzel, 'BEDIENUNG.md');
const ziel = join(wurzel, 'src/app/features/verwaltung/anleitung/anleitung.component.html');

function markdownWandeln(text) {
  let marked;
  try {
    ({ marked } = require('marked'));
  } catch {
    throw new Error('Paket "marked" fehlt. Installation:  npm install --save-dev marked');
  }

  // gfm: für Tabellen. Keine Kopfzeilen-Anker, die braucht die Seite nicht.
  return marked.parse(text, { gfm: true, breaks: false });
}

/** Elemente, die eine eigene Zeile bekommen und ihren Inhalt einrücken. */
const BLOCK_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'blockquote', 'pre', 'hr',
]);

/** Elemente ohne schließendes Gegenstück. */
const LEERE_TAGS = new Set(['hr', 'br', 'img']);

/**
 * Bringt das erzeugte HTML in eine lesbare Form.
 *
 * marked übernimmt die Zeilenumbrüche aus der Markdown-Quelle und rückt
 * verschachtelte Elemente nicht ein — im Template sähe das aus wie
 * willkürlich umbrochener Fließtext. Hier wird stattdessen nach
 * Verschachtelungstiefe eingerückt und der Text neu umbrochen.
 */
function formatiere(html, basistiefe) {
  const ZEILENBREITE = 100;
  const zeilen = [];
  let tiefe = basistiefe;

  // In Blöcke zerlegen: jedes Block-Tag beginnt eine neue Zeile.
  const teile = html
    .replace(/\s+/g, ' ')
    .replace(/<(\/?)(\w+)([^>]*)>/g, (treffer, schraeg, tag) =>
      BLOCK_TAGS.has(tag.toLowerCase()) ? `\n${treffer}\n` : treffer,
    )
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);

  const einzug = () => '  '.repeat(tiefe);

  for (const teil of teile) {
    const schliessend = /^<\/(\w+)/.exec(teil);
    const oeffnend = /^<(\w+)/.exec(teil);

    if (schliessend && BLOCK_TAGS.has(schliessend[1].toLowerCase())) {
      tiefe = Math.max(basistiefe, tiefe - 1);
      zeilen.push(einzug() + teil);
      continue;
    }

    if (oeffnend && BLOCK_TAGS.has(oeffnend[1].toLowerCase())) {
      zeilen.push(einzug() + teil);
      if (!LEERE_TAGS.has(oeffnend[1].toLowerCase())) tiefe++;
      continue;
    }

    // Fließtext: auf mehrere Zeilen verteilen, ohne Tags zu zerreißen.
    zeilen.push(...umbrechen(teil, einzug(), ZEILENBREITE));
  }

  return zusammenfassen(zeilen, ZEILENBREITE).join('\n') + '\n';
}

/**
 * Führt Blöcke wieder auf eine Zeile zusammen, wenn sie dort hineinpassen.
 * Aus drei Zeilen für <h3>Speichern</h3> wird so wieder eine.
 */
function zusammenfassen(zeilen, breite) {
  const ergebnis = [];

  for (let i = 0; i < zeilen.length; i++) {
    const oeffnend = /^(\s*)<(\w+)[^>]*>$/.exec(zeilen[i]);
    const inhalt = zeilen[i + 1];
    const schliessend = zeilen[i + 2];

    if (oeffnend && inhalt && schliessend) {
      const passtZusammen =
        schliessend.trim() === `</${oeffnend[2]}>` &&
        !/^\s*<\w/.test(inhalt) &&
        oeffnend[1].length + oeffnend[0].trim().length + inhalt.trim().length +
          schliessend.trim().length <= breite;

      if (passtZusammen) {
        ergebnis.push(`${oeffnend[1]}${oeffnend[0].trim()}${inhalt.trim()}${schliessend.trim()}`);
        i += 2;
        continue;
      }
    }
    ergebnis.push(zeilen[i]);
  }

  return ergebnis;
}

/** Bricht Text an Leerzeichen um; Tags bleiben unangetastet. */
function umbrechen(text, einzug, breite) {
  const worte = text.split(' ').filter(Boolean);
  const zeilen = [];
  let aktuell = '';

  for (const wort of worte) {
    const kandidat = aktuell ? `${aktuell} ${wort}` : wort;
    if (einzug.length + kandidat.length > breite && aktuell) {
      zeilen.push(einzug + aktuell);
      aktuell = wort;
    } else {
      aktuell = kandidat;
    }
  }
  if (aktuell) zeilen.push(einzug + aktuell);
  return zeilen;
}

/** Überschrift zu einer Sprungmarke: "Typische Abläufe" -> "typische-ablaeufe". */
function marke(text) {
  const umlaute = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, z => umlaute[z])
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Versieht die Abschnittsüberschriften mit Sprungmarken und liefert die
 * Liste für das Inhaltsverzeichnis.
 *
 * marked erzeugt seit Version 12 keine ids mehr an Überschriften — ohne
 * diesen Schritt gäbe es nichts, worauf die Links zeigen könnten.
 */
function markenSetzen(html) {
  const abschnitte = [];
  const vergeben = new Set();

  const mitIds = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (treffer, inhalt) => {
    const titel = inhalt.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // Bei gleichlautenden Überschriften durchnummerieren, damit die
    // Sprungmarken eindeutig bleiben.
    let id = marke(titel);
    let n = 2;
    while (vergeben.has(id)) id = `${marke(titel)}-${n++}`;
    vergeben.add(id);

    abschnitte.push({ id, titel });
    return `<h2 id="${id}">${inhalt}</h2>`;
  });

  return { html: mitIds, abschnitte };
}

function anleitungBauen() {
  if (!existsSync(quelle)) {
    throw new Error(`BEDIENUNG.md nicht gefunden unter ${quelle}`);
  }

  const { html, abschnitte } = markenSetzen(markdownWandeln(readFileSync(quelle, 'utf8')));

  // Angular deutet {{ }} als Interpolation und @if/@for als Steuerblöcke.
  // Im Fließtext kommt beides nicht vor — geprüft wird es trotzdem, damit
  // ein künftiger Text nicht stillschweigend das Template zerlegt.
  const konflikte = [];
  if (html.includes('{{')) konflikte.push('doppelte geschweifte Klammern');
  if (/@(if|for|else|switch|defer|let)\b/.test(html)) konflikte.push('Angular-Steuerblöcke');
  if (konflikte.length > 0) {
    throw new Error(
      `Der Text enthält Zeichen, die Angular als Steuerzeichen deutet: ${konflikte.join(', ')}.`,
    );
  }

  // Die erste Überschrift steht bereits im Seitenkopf.
  const ohneTitel = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, '');
  const eingerueckt = formatiere(ohneTitel, 3);

  const verzeichnis = abschnitte
    .map(
      a =>
        `        <li>\n` +
        `          <a\n` +
        `            href="#${a.id}"\n` +
        `            [class.aktiv]="aktiv() === '${a.id}'"\n` +
        `            (click)="springe($event, '${a.id}')"\n` +
        `          >${a.titel}</a>\n` +
        `        </li>`,
    )
    .join('\n');

  const template = `<div class="seite anleitung">
  <header class="seiten-kopf">
    <div>
    <h1>Bedienung</h1>
    <p class="hinweis">Anleitung zur täglichen Arbeit mit der Vereinsverwaltung</p>
    </div>
    <button type="button" class="drucken" (click)="drucken()">Drucken oder als PDF sichern</button>
  </header>

  <div class="spalten">
    <article class="karte dokument">
${eingerueckt}    </article>

    <nav class="inhalt" aria-label="Abschnitte">
      <p class="inhalt-titel">Abschnitte</p>
      <ul>
${verzeichnis}
      </ul>
    </nav>
  </div>
</div>
`;

  writeFileSync(ziel, template, 'utf8');

  console.log(`Anleitung erzeugt: ${ziel.replace(wurzel + '/', '')}`);
  console.log(`  ${abschnitte.length} Abschnitte, ${template.split('<table').length - 1} Tabellen`);
  console.log(`  ${abschnitte.map(a => a.titel).join(' · ')}`);
}

try {
  anleitungBauen();
} catch (fehler) {
  console.error(`\nAbbruch: ${fehler instanceof Error ? fehler.message : fehler}`);
  process.exit(1);
}
