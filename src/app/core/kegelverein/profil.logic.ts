import { Buchung, Kegelabend, Kegeltermin } from './kegelverein.models';
import { berechneKegelabendErgebnisse } from './kegelabend.logic';
import { sortiereTermine } from './termin.logic';

/**
 * Was ein Mitglied über sich selbst sehen kann.
 *
 * Reine Funktionen ohne Store-Zugriff, damit sie sich einzeln prüfen
 * lassen — wie die übrige Auswertungslogik.
 */

export interface TerminStand {
  termin: Kegeltermin;
  abgemeldet: boolean;
  grund?: string;
}

export interface SpielBilanz {
  abende: number;
  anwesend: number;
  siege: number;
  niederlagen: number;
  /** Siege minus Niederlagen. */
  bilanz: number;
  /** Strafen aus Spielabenden im laufenden Kegeljahr. */
  strafenGesamt: number;
  absagen: number;
}

/**
 * Die kommenden Termine mit dem eigenen Abmeldestand.
 *
 * Vergangene Termine bleiben außen vor: Für die Planung zählt, was noch
 * ansteht.
 */
export function eigeneTermine(mitgliedId: string, termine: readonly Kegeltermin[]): TerminStand[] {
  const jetzt = new Date().toISOString().slice(0, 16);

  // Bewusst ohne erzeugeUebersicht: Hier interessiert nur der eigene
  // Stand, nicht die ganze Teilnehmerliste — das erspart der Profilseite
  // die Abhängigkeit von den Stammdaten.
  return sortiereTermine(termine)
    .filter((t) => t.beginn >= jetzt)
    .map((termin) => {
      const abmeldung = termin.abmeldungen.find((a) => a.mitgliedId === mitgliedId);
      return abmeldung
        ? { termin, abgemeldet: true, grund: abmeldung.grund }
        : { termin, abgemeldet: false };
    });
}

/**
 * Eigene Spielbilanz über die Kegelabende eines Kegeljahres.
 *
 * Gezählt werden nur Abende, an denen man als Teilnehmer geführt ist —
 * wer erst im Januar eingetreten ist, bekommt keine leeren Herbstabende
 * angerechnet.
 */
export function eigeneSpielBilanz(
  mitgliedId: string,
  kegelabende: readonly Kegelabend[],
): SpielBilanz {
  const leer: SpielBilanz = {
    abende: 0,
    anwesend: 0,
    siege: 0,
    niederlagen: 0,
    bilanz: 0,
    strafenGesamt: 0,
    absagen: 0,
  };

  for (const ka of kegelabende) {
    const teilnehmer = ka.teilnehmer.find((t) => t.id === mitgliedId);
    if (!teilnehmer) continue;

    leer.abende++;
    if (teilnehmer.anwesend) leer.anwesend++;
    if (teilnehmer.absage) leer.absagen++;

    const zeile = berechneKegelabendErgebnisse(ka).find((z) => z.teilnehmerId === mitgliedId);
    if (!zeile) continue;

    leer.siege += zeile.siege;
    leer.niederlagen += zeile.niederlagen;
    leer.strafenGesamt += zeile.strafeGesamt;
  }

  leer.bilanz = leer.siege - leer.niederlagen;
  leer.strafenGesamt = Math.round(leer.strafenGesamt * 100) / 100;
  return leer;
}

/**
 * Die eigenen Buchungen, neueste zuerst.
 *
 * Damit lässt sich ein Betrag in der Abrechnung nachvollziehen, ohne den
 * Kassenwart fragen zu müssen — der Journal-Zugang bliebe einer
 * Verwaltungsrolle vorbehalten.
 */
export function eigeneBuchungen(mitgliedId: string, buchungen: readonly Buchung[]): Buchung[] {
  return buchungen
    .filter((b) => b.mitgliedId === mitgliedId)
    .sort((a, b) => b.datum.localeCompare(a.datum));
}
