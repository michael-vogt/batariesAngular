import { describe, expect, it } from 'vitest';
import { eigeneBuchungen, eigeneSpielBilanz, eigeneTermine } from './profil.logic';
import { erstelleBuchung } from './accounting.logic';
import { neueAbmeldung } from './termin.logic';
import { Buchung, Kegelabend, KegelabendTeilnehmer, Kegeltermin } from './kegelverein.models';

/** Zeitpunkt relativ zu jetzt, in Tagen. */
function inTagen(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  const zz = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}T19:30`;
}

function termin(beginn: string, abmeldungen: Kegeltermin['abmeldungen'] = []): Kegeltermin {
  return { id: `t_${beginn}`, beginn, abmeldungen };
}

function tn(id: string, f: Partial<KegelabendTeilnehmer> = {}): KegelabendTeilnehmer {
  return {
    id,
    name: id,
    anwesend: true,
    verspaetungStunden: 0,
    pumpen: 0,
    neuner: 0,
    eingeholt: 0,
    schnaps: 0,
    ...f,
  };
}

function abend(
  id: string,
  teilnehmer: KegelabendTeilnehmer[],
  runden: Kegelabend['runden'] = {},
): Kegelabend {
  return { id, datum: '2026-01-15', teilnehmer, runden };
}

describe('eigeneTermine', () => {
  it('zeigt nur anstehende Termine', () => {
    const stand = eigeneTermine('m1', [termin(inTagen(-3)), termin(inTagen(5))]);
    expect(stand.length).toBe(1);
    expect(stand[0].termin.beginn).toBe(inTagen(5));
  });

  it('erkennt die eigene Abmeldung samt Grund', () => {
    const stand = eigeneTermine('m1', [termin(inTagen(3), [neueAbmeldung('m1', 'Urlaub')])]);
    expect(stand[0].abgemeldet).toBe(true);
    expect(stand[0].grund).toBe('Urlaub');
  });

  it('übergeht Abmeldungen anderer', () => {
    const stand = eigeneTermine('m1', [termin(inTagen(3), [neueAbmeldung('m2', 'Urlaub')])]);
    expect(stand[0].abgemeldet).toBe(false);
    expect(stand[0].grund).toBe(undefined);
  });

  it('sortiert aufsteigend nach Beginn', () => {
    const stand = eigeneTermine('m1', [termin(inTagen(10)), termin(inTagen(2))]);
    expect(stand.map((s) => s.termin.beginn)).toEqual([inTagen(2), inTagen(10)]);
  });
});

describe('eigeneSpielBilanz', () => {
  it('zählt nur Abende, an denen man geführt ist', () => {
    const b = eigeneSpielBilanz('m1', [
      abend('k1', [tn('m1')]),
      abend('k2', [tn('m2')]), // ohne m1
    ]);
    expect(b.abende).toBe(1);
  });

  it('unterscheidet Anwesenheit von Teilnahme am Abend', () => {
    const b = eigeneSpielBilanz('m1', [
      abend('k1', [tn('m1', { anwesend: true })]),
      abend('k2', [tn('m1', { anwesend: false, absage: 'rechtzeitig' })]),
    ]);
    expect(b.abende).toBe(2);
    expect(b.anwesend).toBe(1);
    expect(b.absagen).toBe(1);
  });

  it('summiert Siege, Niederlagen und Bilanz', () => {
    const runden = {
      hohe: [
        { id: 'r1', ergebnisse: { m1: 'gewonnen' as const } },
        { id: 'r2', ergebnisse: { m1: 'verloren' as const } },
        { id: 'r3', ergebnisse: { m1: 'gewonnen' as const } },
      ],
    };
    const b = eigeneSpielBilanz('m1', [abend('k1', [tn('m1')], runden)]);

    expect(b.siege).toBe(2);
    expect(b.niederlagen).toBe(1);
    expect(b.bilanz).toBe(1);
  });

  it('summiert die Strafen über mehrere Abende und rundet auf Cent', () => {
    const b = eigeneSpielBilanz('m1', [
      abend('k1', [tn('m1', { pumpen: 3 })]),
      abend('k2', [tn('m1', { pumpen: 4 })]),
    ]);
    // 7 Pumpen à 0,10 € — ohne Rundung käme 0.7000000000000001 heraus.
    expect(b.strafenGesamt).toBe(0.7);
  });

  it('liefert für ein Mitglied ohne Abende lauter Nullen', () => {
    const b = eigeneSpielBilanz('m1', []);
    expect(b).toEqual({
      abende: 0,
      anwesend: 0,
      siege: 0,
      niederlagen: 0,
      bilanz: 0,
      strafenGesamt: 0,
      absagen: 0,
    });
  });
});

describe('eigeneBuchungen', () => {
  const b = (datum: string, mitgliedId?: string): Buchung =>
    erstelleBuchung({
      datum,
      sollKonto: '100',
      habenKonto: '300',
      betrag: 8,
      buchungstext: 'Monatsbeitrag',
      mitgliedId,
    });

  it('liefert nur die eigenen', () => {
    expect(eigeneBuchungen('m1', [b('2026-01-01', 'm1'), b('2026-01-02', 'm2')]).length).toBe(1);
  });

  it('übergeht Buchungen ohne Zuordnung', () => {
    expect(eigeneBuchungen('m1', [b('2026-01-01')]).length).toBe(0);
  });

  it('sortiert neueste zuerst', () => {
    const liste = eigeneBuchungen('m1', [
      b('2026-01-01', 'm1'),
      b('2026-03-01', 'm1'),
      b('2026-02-01', 'm1'),
    ]);
    expect(liste.map((x) => x.datum)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });
});
