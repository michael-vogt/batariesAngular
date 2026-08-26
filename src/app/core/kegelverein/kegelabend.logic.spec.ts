import { describe, it, expect } from 'vitest';
import { berechneKegelabendErgebnisse } from './kegelabend.logic';
import {
  Kegelabend,
  KegelabendTeilnehmer,
  SpielKey,
  SpielRunde,
  SpielStatus,
  STANDARD_STRAFSAETZE,
} from './kegelverein.models';

/**
 * Die Strafenlogik ist die Stelle mit den meisten Sonderregeln — und die
 * einzige, deren Fehler erst Wochen später beim Abgleich der Kasse
 * auffallen würden. Beim Portieren aus der Altanwendung war hier bereits
 * ein Fall untergegangen (Fuchsjagd ohne Sieger), deshalb sind die
 * Sonderregeln hier einzeln festgehalten.
 */

function teilnehmer(id: string, felder: Partial<KegelabendTeilnehmer> = {}): KegelabendTeilnehmer {
  return {
    id,
    name: id,
    anwesend: true,
    verspaetungStunden: 0,
    pumpen: 0,
    neuner: 0,
    eingeholt: 0,
    schnaps: 0,
    ...felder,
  };
}

function runde(ergebnisse: Record<string, SpielStatus>): SpielRunde {
  return { id: `r_${Math.random()}`, ergebnisse };
}

function abend(
  teilnehmerListe: KegelabendTeilnehmer[],
  runden: Partial<Record<SpielKey, SpielRunde[]>> = {},
): Kegelabend {
  return { id: 'ka1', datum: '2026-01-15', teilnehmer: teilnehmerListe, runden };
}

/** Strafbetrag eines Teilnehmers, auf Cent gerundet. */
function strafe(ka: Kegelabend, id: string): number {
  return berechneKegelabendErgebnisse(ka).find((z) => z.teilnehmerId === id)!.strafeGesamt;
}

describe('berechneKegelabendErgebnisse', () => {
  describe('Siege und Niederlagen', () => {
    it('zählt Siege, Niederlagen und die Bilanz', () => {
      const ka = abend([teilnehmer('a'), teilnehmer('b')], {
        hohe: [
          runde({ a: 'gewonnen', b: 'verloren' }),
          runde({ a: 'gewonnen', b: 'teilgenommen' }),
          runde({ a: 'verloren', b: 'gewonnen' }),
        ],
      });

      const a = berechneKegelabendErgebnisse(ka).find((z) => z.teilnehmerId === 'a')!;
      expect(a.siege).toBe(2);
      expect(a.niederlagen).toBe(1);
      expect(a.bilanz).toBe(1);
    });

    it('behandelt fehlende Einträge als nicht teilgenommen', () => {
      // In der Runde steht nur a — b darf dadurch keine Strafe bekommen.
      const ka = abend([teilnehmer('a'), teilnehmer('b')], {
        hohe: [runde({ a: 'teilgenommen' })],
      });

      expect(strafe(ka, 'b')).toBe(0);
    });
  });

  describe('Niederlagen', () => {
    it('kostet in normalen Spielen den Standardsatz', () => {
      const ka = abend([teilnehmer('a')], { hohe: [runde({ a: 'verloren' })] });
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.niederlageStandard);
    });

    it('kostet bei Fuchsjagd und Totenkiste den erhöhten Satz', () => {
      for (const spiel of ['fuchsjagd', 'totenkiste'] as const) {
        const ka = abend([teilnehmer('a')], { [spiel]: [runde({ a: 'verloren' })] });
        expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.niederlageFuchsjagdTotenkiste);
      }
    });
  });

  describe('Teilnahme ohne Sieg oder Niederlage', () => {
    it('kostet in normalen Spielen den Teilnahmesatz', () => {
      const ka = abend([teilnehmer('a')], { hohe: [runde({ a: 'teilgenommen' })] });
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.teilnahme);
    });

    it('ist bei Totenkiste kostenlos', () => {
      const ka = abend([teilnehmer('a')], { totenkiste: [runde({ a: 'teilgenommen' })] });
      expect(strafe(ka, 'a')).toBe(0);
    });

    it('kostet bei Fuchsjagd mit Sieger den erhöhten Teilnahmesatz', () => {
      const ka = abend([teilnehmer('a'), teilnehmer('b')], {
        fuchsjagd: [runde({ a: 'teilgenommen', b: 'gewonnen' })],
      });
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.fuchsjagdTeilnahmeMitSieger);
    });

    it('ist bei Fuchsjagd ohne Sieger, aber mit Verlierer kostenlos', () => {
      // Dieser Fall fehlte beim Portieren und verteuerte 22 Auswertungen
      // um je 0,10 €. Er ist der Grund für diese Testdatei.
      const ka = abend([teilnehmer('a'), teilnehmer('b')], {
        fuchsjagd: [runde({ a: 'teilgenommen', b: 'verloren' })],
      });
      expect(strafe(ka, 'a')).toBe(0);
    });

    it('kostet bei Fuchsjagd ohne Sieger und ohne Verlierer den Teilnahmesatz', () => {
      const ka = abend([teilnehmer('a'), teilnehmer('b')], {
        fuchsjagd: [runde({ a: 'teilgenommen', b: 'teilgenommen' })],
      });
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.teilnahme);
    });
  });

  describe('Einzelstrafen', () => {
    it('berechnet Verspätung je angefangener Stunde', () => {
      const ka = abend([teilnehmer('a', { verspaetungStunden: 2 })]);
      expect(strafe(ka, 'a')).toBe(2 * STANDARD_STRAFSAETZE.verspaetungProStunde);
    });

    it('berechnet Verspätung auch bei Abwesenheit', () => {
      // Wer absagt und trotzdem zu spät kommt, zahlt: die Verspätung
      // hängt nicht an der Anwesenheit.
      const ka = abend([teilnehmer('a', { anwesend: false, verspaetungStunden: 1 })]);
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.verspaetungProStunde);
    });

    it('berechnet Pumpen nur bei Anwesenheit', () => {
      // Erwartung als Literal: 3 * 0.10 ergibt in Fließkomma
      // 0.30000000000000004, die Implementierung rundet dagegen auf Cent.
      const anwesend = abend([teilnehmer('a', { pumpen: 3 })]);
      expect(strafe(anwesend, 'a')).toBe(0.3);

      const abwesend = abend([teilnehmer('a', { anwesend: false, pumpen: 3 })]);
      expect(strafe(abwesend, 'a')).toBe(0);
    });

    it('rundet die Gesamtstrafe auf volle Cent', () => {
      // 7 Pumpen à 0,10 € — ohne Rundung käme 0.7000000000000001 heraus.
      const ka = abend([teilnehmer('a', { pumpen: 7 })]);
      expect(strafe(ka, 'a')).toBe(0.7);
    });

    it('berechnet die Absagegebühr nach Frist', () => {
      const rechtzeitig = abend([teilnehmer('a', { anwesend: false, absage: 'rechtzeitig' })]);
      expect(strafe(rechtzeitig, 'a')).toBe(STANDARD_STRAFSAETZE.absageRechtzeitig);

      const kurzfristig = abend([teilnehmer('a', { anwesend: false, absage: 'kurzfristig' })]);
      expect(strafe(kurzfristig, 'a')).toBe(STANDARD_STRAFSAETZE.absageKurzfristig);
    });

    it('berechnet das Fernbleiben ohne Absage', () => {
      const ka = abend([teilnehmer('a', { anwesend: false, absage: 'nichtErschienen' })]);
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.absageNichtErschienen);
    });

    it('berechnet die Absagegebühr unabhängig von der Anwesenheit', () => {
      // Wer absagt und dann doch erscheint, zahlt trotzdem — die Gebühr
      // hängt an der Absage, nicht am Fernbleiben.
      const ka = abend([teilnehmer('a', { anwesend: true, absage: 'kurzfristig' })]);
      expect(strafe(ka, 'a')).toBe(STANDARD_STRAFSAETZE.absageKurzfristig);
    });

    it('lässt eine fehlende Absage straffrei', () => {
      const ka = abend([teilnehmer('a', { anwesend: false })]);
      expect(strafe(ka, 'a')).toBe(0);
    });

    it('addiert Absagegebühr und Spielstrafen', () => {
      const ka = abend([teilnehmer('a', { absage: 'rechtzeitig', pumpen: 2 })], {
        hohe: [runde({ a: 'verloren' })],
      });
      // 4,00 + 0,20 + 0,25 = 4,45
      expect(strafe(ka, 'a')).toBe(4.45);
    });

    it('lässt Neuner, Eingeholt und Schnaps straffrei', () => {
      const ka = abend([teilnehmer('a', { neuner: 5, eingeholt: 5, schnaps: 5 })]);
      expect(strafe(ka, 'a')).toBe(0);
    });
  });

  describe('Unabhängigkeit der Teilnehmer', () => {
    it('lässt bestehende Ergebnisse unberührt, wenn ein Gast dazukommt', () => {
      // Die Altanwendung koppelte Ergebnisse über den Array-Index; ein
      // zusätzlicher Spieler verschob dort alle Zuordnungen.
      const runden = { hohe: [runde({ a: 'gewonnen', b: 'verloren' })] };
      const vorher = berechneKegelabendErgebnisse(
        abend([teilnehmer('a'), teilnehmer('b')], runden),
      );
      const nachher = berechneKegelabendErgebnisse(
        abend([teilnehmer('gast'), teilnehmer('a'), teilnehmer('b')], runden),
      );

      for (const id of ['a', 'b']) {
        const alt = vorher.find((z) => z.teilnehmerId === id)!;
        const neu = nachher.find((z) => z.teilnehmerId === id)!;
        expect(neu.strafeGesamt).toBe(alt.strafeGesamt);
        expect(neu.siege).toBe(alt.siege);
      }
      expect(nachher.find((z) => z.teilnehmerId === 'gast')!.strafeGesamt).toBe(0);
    });
  });

  it('summiert über mehrere Spiele und rundet auf Cent', () => {
    const ka = abend([teilnehmer('a', { verspaetungStunden: 1, pumpen: 3 })], {
      hohe: [runde({ a: 'teilgenommen' }), runde({ a: 'verloren' })],
      fuchsjagd: [runde({ a: 'verloren' })],
    });

    // 0,10 + 0,25 + 0,50 + 0,50 (Verspätung) + 0,30 (Pumpen) = 1,65
    expect(strafe(ka, 'a')).toBe(1.65);
  });

  it('akzeptiert abweichende Strafsätze', () => {
    const ka = abend([teilnehmer('a')], { hohe: [runde({ a: 'verloren' })] });
    const ergebnis = berechneKegelabendErgebnisse(ka, {
      ...STANDARD_STRAFSAETZE,
      niederlageStandard: 1,
    });
    expect(ergebnis[0].strafeGesamt).toBe(1);
  });
});
