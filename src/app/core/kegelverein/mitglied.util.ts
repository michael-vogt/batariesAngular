import { Mitglied, MitgliedStatus, StatusEintrag } from './kegelverein.models';

/**
 * Auswertung des Statusverlaufs. Zentral, weil sonst jede aufrufende Stelle
 * ihre eigene Vorstellung davon entwickelt, was "aktuell" bedeutet.
 */

/** Chronologisch sortierte Kopie (aufsteigend nach Datum). */
export function sortierterVerlauf(m: Mitglied): StatusEintrag[] {
  return [...m.statusVerlauf].sort((a, b) => a.ab.localeCompare(b.ab));
}

/**
 * Status zu einem Stichtag.
 *
 * `null` bedeutet: zu diesem Zeitpunkt (noch) kein Mitglied — der erste
 * Verlaufseintrag liegt später. Das ist bewusst von 'ausgetreten' getrennt:
 * "war noch nicht dabei" und "ist gegangen" führen zwar beide dazu, dass
 * keine Beiträge anfallen, sind aber fachlich verschieden.
 */
export function statusZum(m: Mitglied, datum: string): MitgliedStatus | null {
  let treffer: StatusEintrag | null = null;
  for (const eintrag of sortierterVerlauf(m)) {
    if (eintrag.ab <= datum) treffer = eintrag;
    else break;
  }
  return treffer?.status ?? null;
}

/** Heute gültiger Status; `null`, falls der Eintritt in der Zukunft liegt. */
export function aktuellerStatus(m: Mitglied): MitgliedStatus | null {
  return statusZum(m, new Date().toISOString().slice(0, 10));
}

/** Zahlt zum Stichtag Monatsbeitrag? Gastkegler und Ausgetretene nicht. */
export function istBeitragspflichtig(m: Mitglied, datum: string): boolean {
  const status = statusZum(m, datum);
  return status === 'aktiv' || status === 'passiv';
}

/** Gehört zum Verein (aktiv oder passiv), Stichtag heute. */
export function istVereinsmitglied(m: Mitglied): boolean {
  const status = aktuellerStatus(m);
  return status === 'aktiv' || status === 'passiv';
}

export function istGastkegler(m: Mitglied): boolean {
  return aktuellerStatus(m) === 'gastkegler';
}

export function istAusgetreten(m: Mitglied): boolean {
  return aktuellerStatus(m) === 'ausgetreten';
}

/**
 * Ergänzt einen Statuswechsel. Ein bestehender Eintrag mit identischem
 * Datum wird ersetzt, damit mehrfaches Korrigieren am selben Tag nicht
 * zu einer Kette bedeutungsloser Einträge führt.
 */
export function mitStatusaenderung(
  m: Mitglied,
  status: MitgliedStatus,
  ab: string,
  notiz?: string,
): Mitglied {
  const ohneGleichesDatum = m.statusVerlauf.filter((e) => e.ab !== ab);
  const neuerVerlauf = [...ohneGleichesDatum, { ab, status, ...(notiz ? { notiz } : {}) }].sort(
    (a, b) => a.ab.localeCompare(b.ab),
  );
  return { ...m, statusVerlauf: neuerVerlauf };
}

/**
 * Entfernt den Statuseintrag zum angegebenen Datum. Der letzte verbleibende
 * Eintrag lässt sich nicht löschen — ein Mitglied ohne Verlauf hätte keinen
 * ermittelbaren Status und würde die Validierung beim Speichern verletzen.
 */
export function ohneStatuseintrag(m: Mitglied, ab: string): Mitglied {
  if (m.statusVerlauf.length <= 1) return m;
  return { ...m, statusVerlauf: m.statusVerlauf.filter((e) => e.ab !== ab) };
}

/** Neues Mitglied mit Eintritt zum angegebenen Datum. */
export function neuesMitglied(
  name: string,
  status: MitgliedStatus,
  eintritt: string,
  rolle?: string,
): Mitglied {
  return {
    id: crypto.randomUUID(),
    name,
    statusVerlauf: [{ ab: eintritt, status }],
    ...(rolle ? { rolle } : {}),
  };
}

export const STATUS_BEZEICHNUNG: Record<MitgliedStatus, string> = {
  aktiv: 'aktiv',
  passiv: 'passiv',
  gastkegler: 'Gastkegler',
  ausgetreten: 'ausgetreten',
};
