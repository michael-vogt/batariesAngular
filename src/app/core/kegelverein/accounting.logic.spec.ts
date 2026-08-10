import { describe, it, expect } from 'vitest';
import {
  berechneMitgliedFinanzen,
  berechneSalden,
  erstelleBuchung,
  journalEinnahmen,
  journalGeburtstagsumlage,
  journalMonatsbeitraege,
  journalRestguthabenVerrechnung,
  journalStrafen,
} from './accounting.logic';
import { Buchung, KontoNummer, Mitglied } from './kegelverein.models';
import { neuesMitglied } from './mitglied.util';

const DATUM = '2026-01-15';

function buchung(
  sollKonto: KontoNummer,
  habenKonto: KontoNummer,
  betrag: number,
  felder: Partial<Buchung> = {},
): Buchung {
  return erstelleBuchung({
    datum: DATUM,
    sollKonto,
    habenKonto,
    betrag,
    buchungstext: 'Test',
    ...felder,
  });
}

function mitglied(name: string, status: 'aktiv' | 'passiv' | 'gastkegler' = 'aktiv'): Mitglied {
  return neuesMitglied(name, status, '2025-10-01');
}

describe('berechneSalden', () => {
  it('bucht Beträge auf Soll- und Habenseite', () => {
    const salden = berechneSalden([buchung('110', '300', 50)]);
    expect(salden['110'].soll).toBe(50);
    expect(salden['300'].haben).toBe(50);
  });

  it('leitet die GuV aus Erträgen und Aufwendungen ab', () => {
    const salden = berechneSalden([
      buchung('100', '300', 100), // Ertrag
      buchung('400', '110', 30), // Aufwand
    ]);

    expect(salden['250'].haben).toBe(100);
    expect(salden['250'].soll).toBe(30);
  });

  it('überträgt einen Überschuss ins Vereinsvermögen', () => {
    const salden = berechneSalden([buchung('100', '300', 100), buchung('400', '110', 30)]);
    expect(salden['200'].haben - salden['200'].soll).toBe(70);
  });

  it('überträgt einen Fehlbetrag ins Vereinsvermögen', () => {
    const salden = berechneSalden([buchung('100', '300', 30), buchung('400', '110', 100)]);
    expect(salden['200'].soll - salden['200'].haben).toBe(70);
  });

  it('hält die Bilanzgleichung ein', () => {
    // Vermögen = Verbindlichkeiten + Vereinsvermögen. Gilt für jede
    // beliebige Menge von Buchungen, da jede beide Seiten erhöht.
    const salden = berechneSalden([
      buchung('100', '300', 100),
      buchung('110', '100', 40),
      buchung('400', '110', 25),
      buchung('110', '210', 15),
    ]);

    const aktiva =
      salden['100'].soll - salden['100'].haben + (salden['110'].soll - salden['110'].haben);
    const passiva = salden['210'].haben - salden['210'].soll;
    const eigenkapital = salden['200'].haben - salden['200'].soll;

    expect(Math.abs(aktiva - passiva - eigenkapital)).toBeLessThan(0.005);
  });
});

describe('berechneMitgliedFinanzen', () => {
  const m = mitglied('Anna');

  it('erfasst offene Beiträge, Strafen und Umlagen getrennt', () => {
    const f = berechneMitgliedFinanzen(m.id, [
      buchung('100', '300', 8, { mitgliedId: m.id }),
      buchung('100', '310', 3, { mitgliedId: m.id }),
      buchung('100', '320', 10, { mitgliedId: m.id }),
    ]);

    expect(f.offeneBeitraege).toBe(8);
    expect(f.offeneStrafen).toBe(3);
    expect(f.offeneUmlagen).toBe(10);
    expect(f.offeneForderungenGesamt).toBe(21);
  });

  it('ignoriert Buchungen anderer Mitglieder', () => {
    const andere = mitglied('Bert');
    const f = berechneMitgliedFinanzen(m.id, [buchung('100', '300', 8, { mitgliedId: andere.id })]);
    expect(f.offeneForderungenGesamt).toBe(0);
  });

  it('ignoriert Buchungen ohne Mitgliedszuordnung', () => {
    const f = berechneMitgliedFinanzen(m.id, [buchung('400', '110', 50)]);
    expect(f.offeneForderungenGesamt).toBe(0);
  });

  it('tilgt Zahlungen in der Reihenfolge Beitrag, Strafen, Umlagen', () => {
    const f = berechneMitgliedFinanzen(m.id, [
      buchung('100', '300', 8, { mitgliedId: m.id }),
      buchung('100', '310', 5, { mitgliedId: m.id }),
      buchung('100', '320', 10, { mitgliedId: m.id }),
      buchung('110', '100', 10, { mitgliedId: m.id }), // deckt Beitrag + 2 € Strafen
    ]);

    expect(f.offeneBeitraege).toBe(0);
    expect(f.offeneStrafen).toBe(3);
    expect(f.offeneUmlagen).toBe(10);
  });

  it('erfasst Restguthaben aus Überzahlungen', () => {
    const f = berechneMitgliedFinanzen(m.id, [buchung('110', '210', 20, { mitgliedId: m.id })]);
    expect(f.restguthaben).toBe(20);
  });
});

describe('journalMonatsbeitraege', () => {
  it('bucht je Mitglied Forderungen an Beiträge', () => {
    const buchungen = journalMonatsbeitraege({ datum: DATUM, mitglieder: [mitglied('Anna')] });

    expect(buchungen.length).toBe(1);
    expect(buchungen[0].sollKonto).toBe('100');
    expect(buchungen[0].habenKonto).toBe('300');
  });

  it('unterscheidet aktive und passive Beiträge', () => {
    const buchungen = journalMonatsbeitraege({
      datum: DATUM,
      mitglieder: [mitglied('Anna', 'aktiv'), mitglied('Bert', 'passiv')],
      beitragAktiv: 8,
      beitragPassiv: 1,
    });

    expect(buchungen.map((b) => b.betrag).sort()).toEqual([1, 8]);
  });

  it('übergeht Gastkegler', () => {
    const buchungen = journalMonatsbeitraege({
      datum: DATUM,
      mitglieder: [mitglied('Gast', 'gastkegler')],
    });
    expect(buchungen.length).toBe(0);
  });

  it('richtet sich nach dem Status zum Buchungsdatum', () => {
    // Austritt zum 1. März: die Februarbuchung enthält das Mitglied noch,
    // die Märzbuchung nicht mehr.
    const anna: Mitglied = {
      ...mitglied('Anna'),
      statusVerlauf: [
        { ab: '2025-10-01', status: 'aktiv' },
        { ab: '2026-03-01', status: 'ausgetreten' },
      ],
    };

    expect(journalMonatsbeitraege({ datum: '2026-02-01', mitglieder: [anna] }).length).toBe(1);
    expect(journalMonatsbeitraege({ datum: '2026-03-01', mitglieder: [anna] }).length).toBe(0);
  });

  it('übergeht Mitglieder, deren Eintritt später liegt', () => {
    const spaeter = neuesMitglied('Neu', 'aktiv', '2026-06-01');
    expect(journalMonatsbeitraege({ datum: '2026-01-01', mitglieder: [spaeter] }).length).toBe(0);
  });
});

describe('journalStrafen', () => {
  it('bucht Forderungen an Strafen und vermerkt den Kegelabend', () => {
    const m = mitglied('Anna');
    const buchungen = journalStrafen({
      datum: DATUM,
      posten: [{ mitglied: m, betrag: 2.5 }],
      kegelabendId: 'ka1',
    });

    expect(buchungen[0].sollKonto).toBe('100');
    expect(buchungen[0].habenKonto).toBe('310');
    expect(buchungen[0].mitgliedId).toBe(m.id);
    expect(buchungen[0].kegelabendId).toBe('ka1');
  });

  it('lässt Posten ohne Betrag weg', () => {
    const buchungen = journalStrafen({
      datum: DATUM,
      posten: [{ mitglied: mitglied('Anna'), betrag: 0 }],
    });
    expect(buchungen.length).toBe(0);
  });
});

describe('journalEinnahmen', () => {
  it('tilgt offene Forderungen', () => {
    const m = mitglied('Anna');
    const bestand = [buchung('100', '300', 8, { mitgliedId: m.id })];

    const neue = journalEinnahmen({
      datum: DATUM,
      zahlungen: [{ mitglied: m, betrag: 8 }],
      buchungen: bestand,
    });

    const f = berechneMitgliedFinanzen(m.id, [...bestand, ...neue]);
    expect(f.offeneForderungenGesamt).toBe(0);
    expect(f.restguthaben).toBe(0);
  });

  it('schreibt den übersteigenden Betrag als Restguthaben gut', () => {
    const m = mitglied('Anna');
    const bestand = [buchung('100', '300', 8, { mitgliedId: m.id })];

    const neue = journalEinnahmen({
      datum: DATUM,
      zahlungen: [{ mitglied: m, betrag: 20 }],
      buchungen: bestand,
    });

    const f = berechneMitgliedFinanzen(m.id, [...bestand, ...neue]);
    expect(f.offeneForderungenGesamt).toBe(0);
    expect(f.restguthaben).toBe(12);
  });
});

describe('journalRestguthabenVerrechnung', () => {
  it('verrechnet Guthaben mit offenen Forderungen', () => {
    const m = mitglied('Anna');
    const bestand = [
      buchung('110', '210', 20, { mitgliedId: m.id }), // Guthaben
      buchung('100', '300', 8, { mitgliedId: m.id }), // Forderung
    ];

    const neue = journalRestguthabenVerrechnung({
      datum: DATUM,
      mitglieder: [m],
      buchungen: bestand,
    });

    const f = berechneMitgliedFinanzen(m.id, [...bestand, ...neue]);
    expect(f.offeneForderungenGesamt).toBe(0);
    expect(f.restguthaben).toBe(12);
  });

  it('erzeugt nichts ohne Guthaben oder ohne Forderung', () => {
    const m = mitglied('Anna');

    const nurForderung = journalRestguthabenVerrechnung({
      datum: DATUM,
      mitglieder: [m],
      buchungen: [buchung('100', '300', 8, { mitgliedId: m.id })],
    });
    expect(nurForderung.length).toBe(0);

    const nurGuthaben = journalRestguthabenVerrechnung({
      datum: DATUM,
      mitglieder: [m],
      buchungen: [buchung('110', '210', 20, { mitgliedId: m.id })],
    });
    expect(nurGuthaben.length).toBe(0);
  });
});

describe('journalGeburtstagsumlage', () => {
  it('belastet je Gast 10 € pro Person und schreibt die Summe dem Ausrichter gut', () => {
    const ausrichter = mitglied('Anna');
    const gast1 = mitglied('Bert');
    const gast2 = mitglied('Clara');

    const buchungen = journalGeburtstagsumlage({
      datum: DATUM,
      ausrichter,
      gaeste: [
        { mitglied: gast1, anzahlZusatzpersonen: 0 },
        { mitglied: gast2, anzahlZusatzpersonen: 1 },
      ],
    });

    const forderungen = buchungen.filter((b) => b.habenKonto === '320');
    expect(forderungen.map((b) => b.betrag)).toEqual([10, 20]);

    const gutschrift = buchungen.find((b) => b.habenKonto === '210')!;
    expect(gutschrift.betrag).toBe(30);
    expect(gutschrift.mitgliedId).toBe(ausrichter.id);
  });
});

describe('erstelleBuchung', () => {
  it('vergibt eindeutige Kennungen', () => {
    const a = buchung('110', '300', 1);
    const b = buchung('110', '300', 1);
    expect(a.id === b.id).toBe(false);
  });
});
