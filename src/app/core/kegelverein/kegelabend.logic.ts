import {
  Kegelabend,
  KegelabendErgebnisZeile,
  SpielKey,
  STANDARD_STRAFSAETZE,
  Strafsaetze,
} from './kegelverein.models';

/**
 * Berechnet Siege/Niederlagen/Strafen je Teilnehmer eines Kegelabends.
 * Reine Funktion — kein Store-Zugriff, direkt testbar.
 */
export function berechneKegelabendErgebnisse(
  ka: Kegelabend,
  strafsaetze: Strafsaetze = STANDARD_STRAFSAETZE,
): KegelabendErgebnisZeile[] {
  const zeilen = new Map<string, KegelabendErgebnisZeile>();
  for (const t of ka.teilnehmer) {
    zeilen.set(t.id, { teilnehmerId: t.id, siege: 0, niederlagen: 0, bilanz: 0, strafeGesamt: 0 });
  }

  for (const spielKey of Object.keys(ka.runden) as SpielKey[]) {
    for (const runde of ka.runden[spielKey] ?? []) {
      const statusWerte = Object.values(runde.ergebnisse);
      const gewinnerVorhanden = statusWerte.includes('gewonnen');
      const verliererVorhanden = statusWerte.includes('verloren');

      for (const [teilnehmerId, status] of Object.entries(runde.ergebnisse)) {
        const zeile = zeilen.get(teilnehmerId);
        if (!zeile) continue;

        if (status === 'gewonnen') {
          zeile.siege++;
        } else if (status === 'verloren') {
          zeile.niederlagen++;
          zeile.strafeGesamt +=
            spielKey === 'totenkiste' || spielKey === 'fuchsjagd'
              ? strafsaetze.niederlageFuchsjagdTotenkiste
              : strafsaetze.niederlageStandard;
        } else if (status === 'teilgenommen') {
          if (spielKey === 'fuchsjagd' && gewinnerVorhanden) {
            zeile.strafeGesamt += strafsaetze.fuchsjagdTeilnahmeMitSieger;
          } else if (spielKey === 'fuchsjagd' && verliererVorhanden) {
            // Fuchsjagd ohne Sieger, aber mit Verlierer: straffrei für Mitläufer
          } else if (spielKey === 'totenkiste') {
            // Totenkiste: reine Teilnahme ist straffrei
          } else {
            zeile.strafeGesamt += strafsaetze.teilnahme;
          }
        }
      }
    }
  }

  for (const t of ka.teilnehmer) {
    const zeile = zeilen.get(t.id)!;
    zeile.bilanz = zeile.siege - zeile.niederlagen;
    zeile.strafeGesamt += t.verspaetungStunden * strafsaetze.verspaetungProStunde;

    // Absagegebühr: unabhängig von der Anwesenheit - wer absagt, ist ja gerade nicht da.
    if (t.absage === 'rechtzeitig') zeile.strafeGesamt += strafsaetze.absageRechtzeitig;
    if (t.absage === 'kurzfristig') zeile.strafeGesamt += strafsaetze.absageKurzfristig;
    if (t.absage === 'nichtErschienen') zeile.strafeGesamt += strafsaetze.absageNichtErschienen;

    if (t.anwesend) zeile.strafeGesamt += t.pumpen * strafsaetze.pumpe;
    zeile.strafeGesamt = Math.round(zeile.strafeGesamt * 100) / 100;
  }

  return [...zeilen.values()];
}
