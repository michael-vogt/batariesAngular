import { Buchung, Kegelabend, Kegeljahr, Kegeltermin, Mitglied } from '../kegelverein.models';
import {
  KegeljahrDatei,
  Manifest,
  MitgliederDatei,
  SCHEMA_VERSION,
  TermineDatei,
} from './file-storage.models';

/**
 * Bewusst ohne zod/io-ts o.ä.: für dieses überschaubare Schema reichen
 * handgeschriebene Typ-Guards, ohne zusätzliche Abhängigkeit einzuführen.
 * Wichtig ist vor allem: Laden/Speichern bricht LAUT ab statt still mit
 * kaputten Daten weiterzumachen (das war ein Problem der Legacy-App).
 */

export class ValidierungsFehler extends Error {}

function pruefe(bedingung: boolean, meldung: string): void {
  if (!bedingung) throw new ValidierungsFehler(meldung);
}

function istString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Datumsangaben im Format JJJJ-MM-TT.
 *
 * Ein reiner typeof-Test würde auch "" oder "irgendwas" durchlassen. Da
 * sämtliche Zeitvergleiche in der Anwendung auf der Zeichenkette selbst
 * beruhen (Filter, Stichtage, Statusverlauf), wäre ein solcher Wert
 * schlimmer als ein fehlender: er fällt nirgends auf, sortiert aber
 * falsch. Zusätzlich wird geprüft, dass es den Tag wirklich gibt —
 * "2026-02-31" hat das richtige Format, aber kein Gegenstück im Kalender.
 */
function istDatum(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const datum = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(datum.getTime()) && datum.toISOString().slice(0, 10) === v;
}

function istZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const ERLAUBTE_STATUS = ['aktiv', 'passiv', 'gastkegler', 'ausgetreten'];

export function pruefeMitglied(v: unknown): asserts v is Mitglied {
  const m = v as Mitglied;
  pruefe(!!m && istString(m.id) && istString(m.name), 'Mitglied: id/name fehlen oder ungültig');
  pruefe(
    Array.isArray(m.statusVerlauf) && m.statusVerlauf.length > 0,
    `Mitglied "${m.name}": statusVerlauf fehlt oder ist leer`,
  );
  for (const eintrag of m.statusVerlauf) {
    pruefe(
      istDatum(eintrag.ab),
      `Mitglied "${m.name}": Statuseintrag mit ungültigem Datum "${eintrag.ab}"`,
    );
    pruefe(
      ERLAUBTE_STATUS.includes(eintrag.status),
      `Mitglied "${m.name}": ungültiger Status "${eintrag.status}"`,
    );
  }
}

export function pruefeMitgliederDatei(json: unknown): MitgliederDatei {
  const datei = json as MitgliederDatei;
  pruefe(
    datei?.schemaVersion === SCHEMA_VERSION,
    `mitglieder.json: unbekannte/fehlende schemaVersion (erwartet ${SCHEMA_VERSION})`,
  );
  pruefe(Array.isArray(datei.mitglieder), 'mitglieder.json: mitglieder fehlt');
  datei.mitglieder.forEach(pruefeMitglied);

  const ids = new Set<string>();
  for (const m of datei.mitglieder) {
    pruefe(!ids.has(m.id), `Mitglied "${m.name}": id ${m.id} kommt mehrfach vor`);
    ids.add(m.id);
  }
  return datei;
}

export function pruefeBuchung(v: unknown): asserts v is Buchung {
  const b = v as Buchung;
  pruefe(!!b && istString(b.id), 'Buchung: id fehlt');
  pruefe(
    istDatum(b.datum),
    `Buchung ${b.id}: datum "${b.datum}" ist kein Datum im Format JJJJ-MM-TT`,
  );
  pruefe(istString(b.sollKonto) && istString(b.habenKonto), `Buchung ${b.id}: Konten fehlen`);
  pruefe(b.sollKonto !== b.habenKonto, `Buchung ${b.id}: Soll- und Habenkonto identisch`);
  pruefe(istZahl(b.betrag) && b.betrag > 0, `Buchung ${b.id}: betrag muss > 0 sein`);
  pruefe(istString(b.buchungstext), `Buchung ${b.id}: buchungstext fehlt`);
}

export function pruefeKegelabend(v: unknown): asserts v is Kegelabend {
  const ka = v as Kegelabend;
  pruefe(!!ka && istString(ka.id), 'Kegelabend: id fehlt');
  pruefe(
    istDatum(ka.datum),
    `Kegelabend ${ka.id}: datum "${ka.datum}" ist kein Datum im Format JJJJ-MM-TT`,
  );
  pruefe(Array.isArray(ka.teilnehmer), `Kegelabend ${ka.id}: teilnehmer fehlt`);
  pruefe(typeof ka.runden === 'object' && ka.runden !== null, `Kegelabend ${ka.id}: runden fehlt`);
}

/**
 * `bekannteMitgliedIds` kommt aus mitglieder.json. Ohne die Menge wird die
 * referentielle Prüfung übersprungen — sinnvoll etwa während einer
 * Migration, wenn die Stammdaten noch nicht geschrieben sind.
 */
/**
 * Zeitpunkt im Format JJJJ-MM-TTTHH:MM. Wie bei istDatum wird geprüft,
 * dass es den Tag tatsächlich gibt — und zusätzlich, dass die Uhrzeit im
 * gültigen Bereich liegt.
 */
function istZeitpunkt(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return false;
  const [datum, zeit] = v.split('T');
  if (!istDatum(datum)) return false;
  const [stunde, minute] = zeit.split(':').map(Number);
  return stunde < 24 && minute < 60;
}

export function pruefeTermin(v: unknown): asserts v is Kegeltermin {
  const t = v as Kegeltermin;
  pruefe(!!t && istString(t.id), 'Kegeltermin: id fehlt');
  pruefe(
    istZeitpunkt(t.beginn),
    `Kegeltermin ${t.id}: beginn "${t.beginn}" ist kein Zeitpunkt im Format JJJJ-MM-TTTHH:MM`,
  );
  pruefe(Array.isArray(t.abmeldungen), `Kegeltermin ${t.beginn}: abmeldungen fehlt`);

  const ids = new Set<string>();
  for (const a of t.abmeldungen) {
    pruefe(
      istString(a.id) && istString(a.mitgliedId),
      `Kegeltermin ${t.beginn}: Abmeldung ohne id`,
    );
    pruefe(istString(a.grund), `Kegeltermin ${t.beginn}: Abmeldung ohne Grund`);
    pruefe(
      istZeitpunkt(a.gemeldetAm),
      `Kegeltermin ${t.beginn}: Abmeldung mit ungültigem Zeitpunkt "${a.gemeldetAm}"`,
    );
    // Doppelte Abmeldungen desselben Mitglieds wären widersprüchlich.
    pruefe(!ids.has(a.mitgliedId), `Kegeltermin ${t.beginn}: Mitglied ist mehrfach abgemeldet`);
    ids.add(a.mitgliedId);
  }
}

/**
 * `bekannteMitgliedIds` prüft die Abmeldungen gegen die Stammdaten. Ohne
 * die Menge wird das übersprungen — die Termindatei lässt sich dadurch
 * auch lesen, bevor die Mitglieder geladen sind.
 */
export function pruefeTermineDatei(json: unknown, bekannteMitgliedIds?: Set<string>): TermineDatei {
  const datei = json as TermineDatei;
  pruefe(
    datei?.schemaVersion === SCHEMA_VERSION,
    `termine.json: unbekannte/fehlende schemaVersion (erwartet ${SCHEMA_VERSION})`,
  );
  pruefe(Array.isArray(datei.termine), 'termine.json: termine fehlt');
  datei.termine.forEach(pruefeTermin);

  if (bekannteMitgliedIds) {
    for (const t of datei.termine) {
      for (const a of t.abmeldungen) {
        pruefe(
          bekannteMitgliedIds.has(a.mitgliedId),
          `Kegeltermin ${t.beginn}: Abmeldung verweist auf kein bekanntes Mitglied`,
        );
      }
    }
  }
  return datei;
}

export function pruefeKegeljahr(
  v: unknown,
  bekannteMitgliedIds?: Set<string>,
): asserts v is Kegeljahr {
  const kj = v as Kegeljahr;
  pruefe(!!kj && istString(kj.id) && istString(kj.bezeichnung), 'Kegeljahr: id/bezeichnung fehlen');
  pruefe(
    istDatum(kj.startDatum),
    `Kegeljahr ${kj.id}: startDatum "${kj.startDatum}" ist kein Datum im Format JJJJ-MM-TT`,
  );
  pruefe(
    istDatum(kj.endDatum),
    `Kegeljahr ${kj.id}: endDatum "${kj.endDatum}" ist kein Datum im Format JJJJ-MM-TT`,
  );
  pruefe(kj.startDatum <= kj.endDatum, `Kegeljahr ${kj.id}: startDatum liegt nach endDatum`);
  pruefe(Array.isArray(kj.buchungen), `Kegeljahr ${kj.id}: buchungen fehlt`);
  pruefe(Array.isArray(kj.kegelabende), `Kegeljahr ${kj.id}: kegelabende fehlt`);

  kj.buchungen.forEach(pruefeBuchung);
  kj.kegelabende.forEach(pruefeKegelabend);

  if (!bekannteMitgliedIds) return;

  for (const b of kj.buchungen) {
    pruefe(
      b.mitgliedId === undefined || bekannteMitgliedIds.has(b.mitgliedId),
      `Buchung ${b.id}: mitgliedId "${b.mitgliedId}" ist keinem Mitglied zugeordnet`,
    );
  }
  for (const ka of kj.kegelabende) {
    for (const t of ka.teilnehmer) {
      pruefe(
        bekannteMitgliedIds.has(t.id),
        `Kegelabend ${ka.datum}: Teilnehmer "${t.name}" ist keinem Mitglied zugeordnet`,
      );
    }
  }
}

export function pruefeKegeljahrDatei(
  json: unknown,
  bekannteMitgliedIds?: Set<string>,
): KegeljahrDatei {
  const datei = json as KegeljahrDatei;
  pruefe(
    datei?.schemaVersion === SCHEMA_VERSION,
    `Unbekannte/fehlende schemaVersion (erwartet ${SCHEMA_VERSION})`,
  );
  pruefeKegeljahr(datei.kegeljahr, bekannteMitgliedIds);
  return datei;
}

export function pruefeManifest(json: unknown): Manifest {
  const m = json as Manifest;
  // Ältere Versionen sind lesbar (das Manifest ist nur ein Verzeichnis der
  // Dateien); die eigentliche Migration entscheidet der VereinsdatenService
  // anhand von schemaVersion. Neuere Versionen kann diese App nicht kennen.
  pruefe(
    typeof m?.schemaVersion === 'number' && m.schemaVersion <= SCHEMA_VERSION,
    `manifest.json: Schema-Version ${m?.schemaVersion} wird nicht unterstützt (maximal ${SCHEMA_VERSION})`,
  );
  pruefe(istString(m.aktuellesKegeljahrId), 'manifest.json: aktuellesKegeljahrId fehlt');
  pruefe(Array.isArray(m.kegeljahre), 'manifest.json: kegeljahre fehlt');
  return m;
}
