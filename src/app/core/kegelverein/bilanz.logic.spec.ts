import { describe, expect, it } from 'vitest';
import { erzeugeJahresbericht } from './bilanz.logic';
import { erstelleBuchung } from './accounting.logic';
import { Buchung, Kegeljahr, KontoNummer } from './kegelverein.models';

function buchung(sollKonto: KontoNummer, habenKonto: KontoNummer, betrag: number): Buchung {
  return erstelleBuchung({
    datum: '2025-11-01',
    sollKonto,
    habenKonto,
    betrag,
    buchungstext: 'Test',
  });
}

function jahr(buchungen: Buchung[]): Kegeljahr {
  return {
    id: 'kj1',
    bezeichnung: 'Kegeljahr 2025/2026',
    startDatum: '2025-10-01',
    endDatum: '2026-09-30',
    buchungen,
    kegelabende: [],
  };
}

/**
 * Eröffnungsbuchungen wie beim Jahreswechsel: Vermögen und Kasse über das
 * Eröffnungsbilanzkonto, dazu eine Forderung.
 */
function eroeffnung(vermoegen: number, kasse: number, forderung = 0): Buchung[] {
  const buchungen = [buchung('000', '200', vermoegen), buchung('110', '000', kasse)];
  if (forderung > 0) buchungen.push(buchung('100', '000', forderung));
  return buchungen;
}

describe('erzeugeJahresbericht', () => {
  describe('Eröffnungsbilanz', () => {
    it('bildet allein die Eröffnungsbuchungen ab', () => {
      const b = erzeugeJahresbericht(
        jahr([
          ...eroeffnung(100, 100),
          // Diese Buchung darf die Eröffnungsbilanz nicht verändern.
          buchung('100', '300', 50),
        ]),
      );

      expect(b.eroeffnungsbilanz.kasse).toBe(100);
      expect(b.eroeffnungsbilanz.forderungen).toBe(0);
    });

    it('geht auf', () => {
      // Vermögen 120 = Kasse 100 + Forderung 20; das
      // Eröffnungsbilanzkonto gleicht sich damit aus.
      const b = erzeugeJahresbericht(jahr(eroeffnung(120, 100, 20)));

      expect(b.eroeffnungsbilanz.summeAktiva).toBe(120);
      expect(b.eroeffnungsbilanz.summePassiva).toBe(120);
      expect(b.eroeffnungsbilanz.differenz).toBe(0);
    });

    it('ist leer, wenn es keine Eröffnungsbuchungen gibt', () => {
      const b = erzeugeJahresbericht(jahr([buchung('110', '300', 50)]));
      expect(b.eroeffnungsbilanz.summeAktiva).toBe(0);
    });
  });

  describe('Schlussbilanz', () => {
    it('berücksichtigt alle Buchungen', () => {
      const b = erzeugeJahresbericht(
        jahr([...eroeffnung(100, 100), buchung('100', '300', 50), buchung('400', '110', 30)]),
      );

      expect(b.schlussbilanz.forderungen).toBe(50);
      expect(b.schlussbilanz.kasse).toBe(70);
    });

    it('geht auf', () => {
      const b = erzeugeJahresbericht(
        jahr([
          ...eroeffnung(100, 100),
          buchung('100', '300', 50),
          buchung('400', '110', 30),
          buchung('110', '210', 25),
        ]),
      );

      expect(b.schlussbilanz.differenz).toBe(0);
    });
  });

  describe('Gewinn- und Verlustrechnung', () => {
    it('summiert Erträge nach Art', () => {
      const b = erzeugeJahresbericht(
        jahr([
          buchung('100', '300', 100),
          buchung('100', '310', 50),
          buchung('100', '320', 20),
          buchung('110', '330', 30),
        ]),
      );

      expect(b.guv.beitraege).toBe(100);
      expect(b.guv.strafen).toBe(50);
      expect(b.guv.umlagen).toBe(20);
      expect(b.guv.sonstigeErtraege).toBe(30);
      expect(b.guv.ertraegeGesamt).toBe(200);
    });

    it('summiert Aufwendungen nach Art', () => {
      const b = erzeugeJahresbericht(
        jahr([
          buchung('400', '110', 300),
          buchung('410', '110', 500),
          buchung('420', '110', 81),
          buchung('430', '110', 70),
        ]),
      );

      expect(b.guv.aufwendungenGesamt).toBe(951);
    });

    it('weist einen Überschuss positiv aus', () => {
      const b = erzeugeJahresbericht(jahr([buchung('110', '300', 100), buchung('400', '110', 30)]));
      expect(b.guv.ergebnis).toBe(70);
    });

    it('weist einen Fehlbetrag negativ aus', () => {
      // Zahlen aus dem Muster: 782,15 Erträge gegen 951,15 Aufwendungen.
      const b = erzeugeJahresbericht(
        jahr([
          buchung('100', '300', 492),
          buchung('100', '310', 251.15),
          buchung('110', '330', 39),
          buchung('400', '110', 300),
          buchung('410', '110', 500),
          buchung('420', '110', 81),
          buchung('430', '110', 70.15),
        ]),
      );

      expect(b.guv.ertraegeGesamt).toBe(782.15);
      expect(b.guv.aufwendungenGesamt).toBe(951.15);
      expect(b.guv.ergebnis).toBe(-169);
    });
  });

  describe('Gegenprobe', () => {
    it('bestätigt, dass das Ergebnis die Vermögensänderung erklärt', () => {
      const b = erzeugeJahresbericht(
        jahr([...eroeffnung(100, 100), buchung('110', '300', 60), buchung('400', '110', 20)]),
      );

      expect(b.probe.vermoegensaenderung).toBe(40);
      expect(b.probe.ergebnis).toBe(40);
      expect(b.probe.stimmt).toBe(true);
    });

    it('gilt auch bei einem Fehlbetrag', () => {
      const b = erzeugeJahresbericht(jahr([...eroeffnung(100, 100), buchung('400', '110', 25)]));

      expect(b.probe.vermoegensaenderung).toBe(-25);
      expect(b.probe.stimmt).toBe(true);
    });
  });

  it('übernimmt Bezeichnung und Zeitraum des Kegeljahres', () => {
    const b = erzeugeJahresbericht(jahr([]));
    expect(b.bezeichnung).toBe('Kegeljahr 2025/2026');
    expect(b.startDatum).toBe('2025-10-01');
    expect(b.endDatum).toBe('2026-09-30');
  });
});
