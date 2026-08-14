import { describe, expect, it } from 'vitest';
import {
  erzeugeUebersicht,
  naechsterTermin,
  neueAbmeldung,
  neuerTermin,
  sortiereTermine,
} from './termin.logic';
import { neuesMitglied } from './mitglied.util';
import { Kegeltermin, Mitglied } from './kegelverein.models';

/** Zeitpunkt relativ zu jetzt, in Tagen. */
function inTagen(tage: number, uhrzeit = '19:30'): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  const zz = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}T${uhrzeit}`;
}

function termin(beginn: string, abmeldungen: Kegeltermin['abmeldungen'] = []): Kegeltermin {
  return { id: `t_${beginn}`, beginn, abmeldungen };
}

describe('neuerTermin', () => {
  it('legt einen Termin ohne Abmeldungen an', () => {
    const t = neuerTermin('2026-09-04T19:30');
    expect(t.beginn).toBe('2026-09-04T19:30');
    expect(t.abmeldungen).toEqual([]);
  });

  it('lässt optionale Angaben weg statt sie leer zu setzen', () => {
    const t = neuerTermin('2026-09-04T19:30');
    expect('ort' in t).toBe(false);
    expect('notiz' in t).toBe(false);
  });

  it('übernimmt Ort und Notiz', () => {
    const t = neuerTermin('2026-09-04T19:30', 'Gaststätte Krug', 'mit Gästen');
    expect(t.ort).toBe('Gaststätte Krug');
    expect(t.notiz).toBe('mit Gästen');
  });
});

describe('neueAbmeldung', () => {
  it('vermerkt Mitglied, Grund und Zeitpunkt', () => {
    const a = neueAbmeldung('m1', '  Urlaub  ');
    expect(a.mitgliedId).toBe('m1');
    expect(a.grund).toBe('Urlaub');
    expect(a.gemeldetAm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('sortiereTermine', () => {
  it('stellt anstehende Termine voran, aufsteigend', () => {
    const sortiert = sortiereTermine([termin(inTagen(14)), termin(inTagen(3)), termin(inTagen(7))]);
    expect(sortiert.map((t) => t.beginn)).toEqual([inTagen(3), inTagen(7), inTagen(14)]);
  });

  it('hängt vergangene Termine hinten an, neueste zuerst', () => {
    const sortiert = sortiereTermine([
      termin(inTagen(-30)),
      termin(inTagen(5)),
      termin(inTagen(-2)),
    ]);
    expect(sortiert.map((t) => t.beginn)).toEqual([inTagen(5), inTagen(-2), inTagen(-30)]);
  });
});

describe('naechsterTermin', () => {
  it('liefert den frühesten anstehenden Termin', () => {
    const t = naechsterTermin([termin(inTagen(10)), termin(inTagen(2)), termin(inTagen(-1))]);
    expect(t?.beginn).toBe(inTagen(2));
  });

  it('liefert null, wenn alle Termine vergangen sind', () => {
    expect(naechsterTermin([termin(inTagen(-1))])).toBe(null);
  });
});

describe('erzeugeUebersicht', () => {
  const anna = neuesMitglied('Anna', 'aktiv', '2025-10-01');
  const bert = neuesMitglied('Bert', 'aktiv', '2025-10-01');
  const gast = neuesMitglied('Gast', 'gastkegler', '2025-10-01');
  const passiv = neuesMitglied('Paul', 'passiv', '2025-10-01');
  const mitglieder: Mitglied[] = [anna, bert, gast, passiv];

  it('erwartet nur aktive Mitglieder ohne Abmeldung', () => {
    const u = erzeugeUebersicht(termin(inTagen(3)), mitglieder);
    expect(u.erwartet.map((m) => m.name)).toEqual(['Anna', 'Bert']);
  });

  it('nimmt Abgemeldete aus den Erwarteten heraus', () => {
    const u = erzeugeUebersicht(termin(inTagen(3), [neueAbmeldung(anna.id, 'Urlaub')]), mitglieder);

    expect(u.erwartet.map((m) => m.name)).toEqual(['Bert']);
    expect(u.abgemeldet.map((a) => a.name)).toEqual(['Anna']);
    expect(u.abgemeldet[0].abmeldung.grund).toBe('Urlaub');
  });

  it('meldet unbekannte Kennungen, statt sie zu verschweigen', () => {
    const u = erzeugeUebersicht(termin(inTagen(3), [neueAbmeldung('weg', 'x')]), mitglieder);
    expect(u.abgemeldet[0].name).toBe('unbekannt');
  });

  it('sortiert Abmeldungen nach Namen', () => {
    const u = erzeugeUebersicht(
      termin(inTagen(3), [neueAbmeldung(bert.id, 'a'), neueAbmeldung(anna.id, 'b')]),
      mitglieder,
    );
    expect(u.abgemeldet.map((a) => a.name)).toEqual(['Anna', 'Bert']);
  });

  it('erkennt vergangene Termine', () => {
    expect(erzeugeUebersicht(termin(inTagen(-1)), mitglieder).vergangen).toBe(true);
    expect(erzeugeUebersicht(termin(inTagen(1)), mitglieder).vergangen).toBe(false);
  });
});
