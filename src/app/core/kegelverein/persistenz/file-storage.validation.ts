import { Buchung, Kegelabend, Kegeljahr, Mitglied } from '../kegelverein.models';
import { KegeljahrDatei, Manifest, SCHEMA_VERSION } from './file-storage.models';

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

export function pruefeMitglied(v: unknown): asserts v is Mitglied {
  const m = v as Mitglied;
  pruefe(!!m && istString(m.id) && istString(m.name), 'Mitglied: id/name fehlen oder ungültig');
  pruefe(m.status === 'aktiv' || m.status === 'passiv', `Mitglied "${m.name}": ungültiger status`);
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

export function pruefeKegeljahr(v: unknown): asserts v is Kegeljahr {
  const kj = v as Kegeljahr;
  pruefe(!!kj && istString(kj.id) && istString(kj.bezeichnung), 'Kegeljahr: id/bezeichnung fehlen');
  pruefe(
    istString(kj.startDatum) && istString(kj.endDatum),
    `Kegeljahr ${kj.id}: Datumsfelder fehlen`,
  );
  pruefe(Array.isArray(kj.mitglieder), `Kegeljahr ${kj.id}: mitglieder fehlt`);
  pruefe(Array.isArray(kj.buchungen), `Kegeljahr ${kj.id}: buchungen fehlt`);
  pruefe(Array.isArray(kj.kegelabende), `Kegeljahr ${kj.id}: kegelabende fehlt`);

  kj.mitglieder.forEach(pruefeMitglied);
  kj.buchungen.forEach(pruefeBuchung);
  kj.kegelabende.forEach(pruefeKegelabend);

  // Referentielle Integrität: jede mitgliedId muss existieren
  const bekannteIds = new Set(kj.mitglieder.map((m) => m.id));
  for (const b of kj.buchungen) {
    pruefe(
      b.mitgliedId === undefined || bekannteIds.has(b.mitgliedId),
      `Buchung ${b.id}: mitgliedId "${b.mitgliedId}" existiert nicht in mitglieder[]`,
    );
  }
}

export function pruefeKegeljahrDatei(json: unknown): KegeljahrDatei {
  const datei = json as KegeljahrDatei;
  pruefe(
    datei?.schemaVersion === SCHEMA_VERSION,
    `Unbekannte/fehlende schemaVersion (erwartet ${SCHEMA_VERSION})`,
  );
  pruefeKegeljahr(datei.kegeljahr);
  return datei;
}

export function pruefeManifest(json: unknown): Manifest {
  const m = json as Manifest;
  pruefe(m?.schemaVersion === SCHEMA_VERSION, `manifest.json: unbekannte/fehlende schemaVersion`);
  pruefe(istString(m.aktuellesKegeljahrId), 'manifest.json: aktuellesKegeljahrId fehlt');
  pruefe(Array.isArray(m.kegeljahre), 'manifest.json: kegeljahre fehlt');
  return m;
}
