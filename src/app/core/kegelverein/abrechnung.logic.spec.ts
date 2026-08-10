import { describe, it, expect } from 'vitest';
import { erzeugeAbrechnung } from './abrechnung.logic';
import { bereiteAbschlussVor } from './jahresabschluss.logic';
import { berechneSalden, erstelleBuchung } from './accounting.logic';
import { neuesMitglied } from './mitglied.util';
import { Buchung, Kegeljahr, KontoNummer, Mitglied } from './kegelverein.models';

function buchung(
  sollKonto: KontoNummer,
  habenKonto: KontoNummer,
  betrag: number,
  mitgliedId?: string,
): Buchung {
  return erstelleBuchung({
    datum: '2025-11-01',
    sollKonto,
    habenKonto,
    betrag,
    buchungstext: 'Test',
    mitgliedId,
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

describe('erzeugeAbrechnung', () => {
  const anna = neuesMitglied('Anna', 'aktiv', '2025-10-01');

  it('weist offene Posten nach Art getrennt aus', () => {
    const a = erzeugeAbrechnung({
      mitglieder: [anna],
      buchungen: [
        buchung('100', '300', 8, anna.id),
        buchung('100', '310', 3, anna.id),
        buchung('100', '320', 10, anna.id),
      ],
      stichtag: '2026-01-15',
    });

    expect(a.zeilen[0].beitraege).toBe(8);
    expect(a.zeilen[0].strafen).toBe(3);
    expect(a.zeilen[0].umlagen).toBe(10);
    expect(a.zeilen[0].summe).toBe(21);
  });

  it('rechnet vorhandenes Restguthaben als Ausgleich gegen', () => {
    const a = erzeugeAbrechnung({
      mitglieder: [anna],
      buchungen: [buchung('100', '300', 8, anna.id), buchung('110', '210', 20, anna.id)],
      stichtag: '2026-01-15',
    });

    expect(a.zeilen[0].ausgleich).toBe(8);
    expect(a.zeilen[0].summe).toBe(0);
    expect(a.zeilen[0].verbleibendesRestguthaben).toBe(12);
  });

  it('begrenzt den Ausgleich auf das vorhandene Guthaben', () => {
    const a = erzeugeAbrechnung({
      mitglieder: [anna],
      buchungen: [buchung('100', '300', 30, anna.id), buchung('110', '210', 5, anna.id)],
      stichtag: '2026-01-15',
    });

    expect(a.zeilen[0].ausgleich).toBe(5);
    expect(a.zeilen[0].summe).toBe(25);
    expect(a.zeilen[0].verbleibendesRestguthaben).toBe(0);
  });

  it('blendet Ausgetretene ohne offene Posten aus', () => {
    const weg = neuesMitglied('Weg', 'ausgetreten', '2025-10-01');
    const a = erzeugeAbrechnung({ mitglieder: [anna, weg], buchungen: [], stichtag: '2026-01-15' });
    expect(a.zeilen.map((z) => z.name)).toEqual(['Anna']);
  });

  it('zeigt Ausgetretene mit offenen Posten weiterhin an', () => {
    const weg = neuesMitglied('Weg', 'ausgetreten', '2025-10-01');
    const a = erzeugeAbrechnung({
      mitglieder: [weg],
      buchungen: [buchung('100', '300', 8, weg.id)],
      stichtag: '2026-01-15',
    });
    expect(a.zeilen.length).toBe(1);
  });

  it('sortiert nach Namen und summiert die Spalten', () => {
    const bert = neuesMitglied('Bert', 'aktiv', '2025-10-01');
    const a = erzeugeAbrechnung({
      mitglieder: [bert, anna],
      buchungen: [buchung('100', '300', 8, anna.id), buchung('100', '300', 5, bert.id)],
      stichtag: '2026-01-15',
    });

    expect(a.zeilen.map((z) => z.name)).toEqual(['Anna', 'Bert']);
    expect(a.summen.beitraege).toBe(13);
    expect(a.summen.summe).toBe(13);
  });
});

describe('bereiteAbschlussVor', () => {
  const anna = neuesMitglied('Anna', 'aktiv', '2025-10-01');

  /** Kleines Jahr mit Kasse, Forderung und Restguthaben. */
  function beispieljahr(): { kj: Kegeljahr; mitglieder: Mitglied[] } {
    return {
      kj: jahr([
        buchung('110', '300', 100), // Einnahme in die Kasse
        buchung('100', '310', 15, anna.id), // offene Strafe
        buchung('110', '210', 40, anna.id), // Restguthaben
      ]),
      mitglieder: [anna],
    };
  }

  it('legt das Folgejahr direkt anschließend an', () => {
    const { kj, mitglieder } = beispieljahr();
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj] });

    expect(v.neuesKegeljahr.startDatum).toBe('2026-10-01');
    expect(v.neuesKegeljahr.endDatum).toBe('2027-09-30');
  });

  it('gleicht das Eröffnungsbilanzkonto aus', () => {
    const { kj, mitglieder } = beispieljahr();
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj] });

    expect(v.ausgeglichen).toBe(true);
    expect(v.ebkSoll).toBe(v.ebkHaben);
  });

  it('überträgt Kasse, Forderungen und Restguthaben unverändert', () => {
    const { kj, mitglieder } = beispieljahr();
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj] });

    const alt = berechneSalden(kj.buchungen);
    const neu = berechneSalden(v.neuesKegeljahr.buchungen);

    expect(neu['110'].soll - neu['110'].haben).toBe(alt['110'].soll - alt['110'].haben);
    expect(neu['100'].soll - neu['100'].haben).toBe(alt['100'].soll - alt['100'].haben);
    expect(neu['210'].haben - neu['210'].soll).toBe(alt['210'].haben - alt['210'].soll);
  });

  it('überträgt keine Erträge und Aufwendungen', () => {
    // Sie sind im Vereinsvermögen bereits verrechnet und beginnen im
    // neuen Jahr wieder bei null.
    const { kj, mitglieder } = beispieljahr();
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj] });
    const neu = berechneSalden(v.neuesKegeljahr.buchungen);

    expect(neu['300'].haben).toBe(0);
    expect(neu['310'].haben).toBe(0);
    expect(neu['400'].soll).toBe(0);
  });

  it('beginnt ohne Kegelabende', () => {
    const { kj, mitglieder } = beispieljahr();
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj] });
    expect(v.neuesKegeljahr.kegelabende).toEqual([]);
  });

  it('überträgt Forderungen ohne Mitgliedszuordnung als Sammelposten', () => {
    // Die Altanwendung lief nur über die Mitgliederliste; solche Beträge
    // gingen dort beim Jahreswechsel verloren.
    const kj = jahr([
      buchung('110', '300', 100),
      buchung('100', '310', 16.1), // ohne mitgliedId
    ]);

    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder: [anna], vorhandeneJahre: [kj] });

    const sammel = v.eroeffnungsbuchungen.find((b) =>
      b.buchungstext.includes('ohne Mitgliedszuordnung'),
    );
    expect(sammel?.betrag).toBe(16.1);
    expect(v.ausgeglichen).toBe(true);
    expect(v.warnungen.length > 0).toBe(true);
  });

  it('verweigert den Abschluss, wenn das Folgejahr bereits existiert', () => {
    const { kj, mitglieder } = beispieljahr();
    const folgejahr: Kegeljahr = {
      ...kj,
      id: 'kj2',
      startDatum: '2026-10-01',
      endDatum: '2027-09-30',
    };

    expect(() =>
      bereiteAbschlussVor({ altesJahr: kj, mitglieder, vorhandeneJahre: [kj, folgejahr] }),
    ).toThrow();
  });

  it('meldet einen negativen Kassenbestand als Warnung', () => {
    const kj = jahr([buchung('400', '110', 50)]); // mehr ausgegeben als vorhanden
    const v = bereiteAbschlussVor({ altesJahr: kj, mitglieder: [anna], vorhandeneJahre: [kj] });

    expect(v.warnungen.some((w) => w.includes('Kassenbestand'))).toBe(true);
  });
});
