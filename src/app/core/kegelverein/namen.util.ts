import { Mitglied } from './kegelverein.models';

/**
 * Vergleichsschlüssel für Personennamen.
 *
 * Dublettenprüfung an einer einzigen Stelle: Groß-/Kleinschreibung,
 * überflüssige Leerzeichen und Umlaut-Schreibweisen sollen nicht zu zwei
 * Stammdatensätzen für dieselbe Person führen — sonst zerfällt die
 * Historie (Buchungen, Spielabende) auf zwei Personen.
 *
 * "Müller" und "Mueller" gelten damit als derselbe Name. Das ist bewusst
 * streng: lieber einmal zu viel nachfragen, als eine gespaltene Historie.
 */
export function nameSchluessel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');
}

/**
 * Sucht ein Mitglied mit gleichem Namen. `ausserId` schließt einen Eintrag
 * aus — nötig beim Umbenennen, damit ein Mitglied nicht sich selbst als
 * Dublette meldet.
 */
export function findeNamensdublette(
  mitglieder: readonly Mitglied[],
  name: string,
  ausserId?: string,
): Mitglied | undefined {
  const schluessel = nameSchluessel(name);
  return mitglieder.find((m) => m.id !== ausserId && nameSchluessel(m.name) === schluessel);
}
