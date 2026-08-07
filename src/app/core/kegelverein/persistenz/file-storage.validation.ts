import { Buchung, Kegelabend, Kegeljahr, Mitglied } from '../kegelverein.models';
import { KegeljahrDatei, Manifest, MitgliederDatei, SCHEMA_VERSION } from './file-storage.models';

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
    pruefe(istString(eintrag.ab), `Mitglied "${m.name}": Statuseintrag ohne Datum`);
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
  pruefe(istString(b.datum), `Buchung ${b.id}: datum fehlt/ungültig`);
  pruefe(istString(b.sollKonto) && istString(b.habenKonto), `Buchung ${b.id}: Konten fehlen`);
  pruefe(b.sollKonto !== b.habenKonto, `Buchung ${b.id}: Soll- und Habenkonto identisch`);
  pruefe(istZahl(b.betrag) && b.betrag > 0, `Buchung ${b.id}: betrag muss > 0 sein`);
  pruefe(istString(b.buchungstext), `Buchung ${b.id}: buchungstext fehlt`);
}

export function pruefeKegelabend(v: unknown): asserts v is Kegelabend {
  const ka = v as Kegelabend;
  pruefe(!!ka && istString(ka.id) && istString(ka.datum), 'Kegelabend: id/datum fehlen');
  pruefe(Array.isArray(ka.teilnehmer), `Kegelabend ${ka.id}: teilnehmer fehlt`);
  pruefe(typeof ka.runden === 'object' && ka.runden !== null, `Kegelabend ${ka.id}: runden fehlt`);
}

/**
 * `bekannteMitgliedIds` kommt aus mitglieder.json. Ohne die Menge wird die
 * referentielle Prüfung übersprungen — sinnvoll etwa während einer
 * Migration, wenn die Stammdaten noch nicht geschrieben sind.
 */
export function pruefeKegeljahr(
  v: unknown,
  bekannteMitgliedIds?: Set<string>,
): asserts v is Kegeljahr {
  const kj = v as Kegeljahr;
  pruefe(!!kj && istString(kj.id) && istString(kj.bezeichnung), 'Kegeljahr: id/bezeichnung fehlen');
  pruefe(
    istString(kj.startDatum) && istString(kj.endDatum),
    `Kegeljahr ${kj.id}: Datumsfelder fehlen`,
  );
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
