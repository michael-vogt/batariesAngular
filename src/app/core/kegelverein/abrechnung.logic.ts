import { Buchung, Mitglied } from './kegelverein.models';
import { berechneMitgliedFinanzen } from './accounting.logic';
import { aktuellerStatus } from './mitglied.util';

/**
 * Datengrundlage der monatlichen Abrechnung — dieselben Spalten wie in der
 * Vorgängeranwendung, damit die Liste am Kegelabend vertraut aussieht.
 *
 * "Ausgleich" ist die Verrechnung des Restguthabens mit offenen Posten,
 * in der Reihenfolge Beiträge → Strafen → Umlagen. Sie wird hier nur
 * berechnet, nicht gebucht: die Abrechnung zeigt, was zu zahlen wäre,
 * und lässt die Buchführung unberührt.
 */

export interface AbrechnungsZeile {
  mitgliedId: string;
  name: string;
  beitraege: number;
  strafen: number;
  umlagen: number;
  /** Betrag, der durch vorhandenes Restguthaben gedeckt wird (positiv). */
  ausgleich: number;
  /** Offener Betrag nach Ausgleich — das ist der zu zahlende Betrag. */
  summe: number;
  verbleibendesRestguthaben: number;
}

export interface Abrechnung {
  stichtag: string;
  zeilen: AbrechnungsZeile[];
  summen: {
    beitraege: number;
    strafen: number;
    umlagen: number;
    ausgleich: number;
    summe: number;
    verbleibendesRestguthaben: number;
  };
}

function runde(n: number): number {
  return Math.abs(n) < 0.005 ? 0 : Math.round(n * 100) / 100;
}

export function erzeugeAbrechnung(params: {
  mitglieder: Mitglied[];
  buchungen: Buchung[];
  stichtag: string;
  /** Ausgetretene ohne offene Posten weglassen (Standard: ja). */
  ausgetreteneAusblenden?: boolean;
}): Abrechnung {
  const { mitglieder, buchungen, stichtag, ausgetreteneAusblenden = true } = params;

  const zeilen: AbrechnungsZeile[] = [];

  for (const m of mitglieder) {
    const f = berechneMitgliedFinanzen(m.id, buchungen);
    const hatBewegung = f.offeneForderungenGesamt > 0 || f.restguthaben > 0;

    if (ausgetreteneAusblenden && aktuellerStatus(m) === 'ausgetreten' && !hatBewegung) continue;

    // Verrechnungskaskade wie in journalRestguthabenVerrechnung: erst
    // Beiträge, dann Strafen, dann Umlagen.
    const ausgleichBeitrag = Math.min(f.offeneBeitraege, f.restguthaben);
    const ausgleichStrafen = Math.min(f.offeneStrafen, f.restguthaben - ausgleichBeitrag);
    const ausgleichUmlagen = Math.min(
      f.offeneUmlagen,
      f.restguthaben - ausgleichBeitrag - ausgleichStrafen,
    );
    const ausgleich = runde(ausgleichBeitrag + ausgleichStrafen + ausgleichUmlagen);

    zeilen.push({
      mitgliedId: m.id,
      name: m.name,
      beitraege: f.offeneBeitraege,
      strafen: f.offeneStrafen,
      umlagen: f.offeneUmlagen,
      ausgleich,
      summe: runde(f.offeneForderungenGesamt - ausgleich),
      verbleibendesRestguthaben: runde(f.restguthaben - ausgleich),
    });
  }

  zeilen.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const summe = (auswahl: (z: AbrechnungsZeile) => number) =>
    runde(zeilen.reduce((s, z) => s + auswahl(z), 0));

  return {
    stichtag,
    zeilen,
    summen: {
      beitraege: summe((z) => z.beitraege),
      strafen: summe((z) => z.strafen),
      umlagen: summe((z) => z.umlagen),
      ausgleich: summe((z) => z.ausgleich),
      summe: summe((z) => z.summe),
      verbleibendesRestguthaben: summe((z) => z.verbleibendesRestguthaben),
    },
  };
}
