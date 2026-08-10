import { describe, it, expect } from 'vitest';
import {
  aktuellerStatus,
  istBeitragspflichtig,
  istGastkegler,
  mitStatusaenderung,
  neuesMitglied,
  ohneStatuseintrag,
  sortierterVerlauf,
  statusZum,
} from './mitglied.util';
import { findeNamensdublette, nameSchluessel } from './namen.util';
import { Mitglied } from './kegelverein.models';

describe('statusZum', () => {
  const anna: Mitglied = {
    id: 'm1',
    name: 'Anna',
    statusVerlauf: [
      { ab: '2024-10-01', status: 'aktiv' },
      { ab: '2025-04-01', status: 'passiv' },
      { ab: '2026-03-01', status: 'ausgetreten' },
    ],
  };

  it('liefert den zum Stichtag gültigen Status', () => {
    expect(statusZum(anna, '2024-12-31')).toBe('aktiv');
    expect(statusZum(anna, '2025-06-01')).toBe('passiv');
    expect(statusZum(anna, '2026-06-01')).toBe('ausgetreten');
  });

  it('gilt ab dem Tag des Eintrags einschließlich', () => {
    expect(statusZum(anna, '2025-03-31')).toBe('aktiv');
    expect(statusZum(anna, '2025-04-01')).toBe('passiv');
  });

  it('liefert null vor dem ersten Eintrag', () => {
    // Unterschied zu "ausgetreten": die Person war noch gar nicht dabei.
    expect(statusZum(anna, '2024-01-01')).toBe(null);
  });

  it('kommt mit unsortiertem Verlauf zurecht', () => {
    const unsortiert: Mitglied = {
      ...anna,
      statusVerlauf: [...anna.statusVerlauf].reverse(),
    };
    expect(statusZum(unsortiert, '2025-06-01')).toBe('passiv');
  });
});

describe('sortierterVerlauf', () => {
  it('sortiert aufsteigend nach Datum, ohne das Original zu ändern', () => {
    const m = neuesMitglied('Anna', 'aktiv', '2025-01-01');
    const erweitert = mitStatusaenderung(m, 'passiv', '2024-01-01');

    expect(sortierterVerlauf(erweitert).map((e) => e.ab)).toEqual(['2024-01-01', '2025-01-01']);
  });
});

describe('mitStatusaenderung', () => {
  it('ergänzt einen Eintrag', () => {
    const m = neuesMitglied('Anna', 'aktiv', '2025-10-01');
    const geaendert = mitStatusaenderung(m, 'passiv', '2026-01-01');

    expect(geaendert.statusVerlauf.length).toBe(2);
    expect(aktuellerStatus(geaendert)).toBe('passiv');
  });

  it('ersetzt einen Eintrag mit gleichem Datum', () => {
    // Mehrfaches Korrigieren am selben Tag soll keine Kette erzeugen.
    const m = neuesMitglied('Anna', 'aktiv', '2025-10-01');
    const einmal = mitStatusaenderung(m, 'passiv', '2026-01-01');
    const zweimal = mitStatusaenderung(einmal, 'gastkegler', '2026-01-01');

    expect(zweimal.statusVerlauf.length).toBe(2);
    expect(statusZum(zweimal, '2026-01-01')).toBe('gastkegler');
  });

  it('lässt das ursprüngliche Mitglied unverändert', () => {
    const m = neuesMitglied('Anna', 'aktiv', '2025-10-01');
    mitStatusaenderung(m, 'passiv', '2026-01-01');
    expect(m.statusVerlauf.length).toBe(1);
  });

  it('übernimmt eine Notiz', () => {
    const m = neuesMitglied('Anna', 'aktiv', '2025-10-01');
    const geaendert = mitStatusaenderung(m, 'ausgetreten', '2026-01-01', 'Umzug');
    expect(sortierterVerlauf(geaendert)[1].notiz).toBe('Umzug');
  });
});

describe('ohneStatuseintrag', () => {
  it('entfernt den Eintrag zum angegebenen Datum', () => {
    const m = mitStatusaenderung(
      neuesMitglied('Anna', 'aktiv', '2025-10-01'),
      'ausgetreten',
      '2026-01-01',
    );

    const bereinigt = ohneStatuseintrag(m, '2026-01-01');
    expect(bereinigt.statusVerlauf.length).toBe(1);
    expect(aktuellerStatus(bereinigt)).toBe('aktiv');
  });

  it('behält den letzten Eintrag', () => {
    // Ohne Verlauf hätte das Mitglied keinen ermittelbaren Status und
    // würde die Validierung beim Speichern verletzen.
    const m = neuesMitglied('Anna', 'aktiv', '2025-10-01');
    expect(ohneStatuseintrag(m, '2025-10-01').statusVerlauf.length).toBe(1);
  });
});

describe('istBeitragspflichtig', () => {
  it('gilt für aktive und passive Mitglieder', () => {
    expect(istBeitragspflichtig(neuesMitglied('A', 'aktiv', '2025-01-01'), '2025-06-01')).toBe(
      true,
    );
    expect(istBeitragspflichtig(neuesMitglied('B', 'passiv', '2025-01-01'), '2025-06-01')).toBe(
      true,
    );
  });

  it('gilt nicht für Gastkegler, Ausgetretene und noch nicht Eingetretene', () => {
    const gast = neuesMitglied('G', 'gastkegler', '2025-01-01');
    const ausgetreten = neuesMitglied('X', 'ausgetreten', '2025-01-01');
    const kuenftig = neuesMitglied('N', 'aktiv', '2026-01-01');

    expect(istBeitragspflichtig(gast, '2025-06-01')).toBe(false);
    expect(istBeitragspflichtig(ausgetreten, '2025-06-01')).toBe(false);
    expect(istBeitragspflichtig(kuenftig, '2025-06-01')).toBe(false);
  });
});

describe('istGastkegler', () => {
  it('richtet sich nach dem heutigen Status', () => {
    expect(istGastkegler(neuesMitglied('G', 'gastkegler', '2020-01-01'))).toBe(true);
    expect(istGastkegler(neuesMitglied('A', 'aktiv', '2020-01-01'))).toBe(false);
  });
});

describe('nameSchluessel', () => {
  it('ignoriert Groß- und Kleinschreibung', () => {
    expect(nameSchluessel('Anna Müller')).toBe(nameSchluessel('ANNA MÜLLER'));
  });

  it('ignoriert überflüssige Leerzeichen', () => {
    expect(nameSchluessel('  Anna   Müller ')).toBe(nameSchluessel('Anna Müller'));
  });

  it('setzt Umlautschreibweisen gleich', () => {
    expect(nameSchluessel('Müller')).toBe(nameSchluessel('Mueller'));
    expect(nameSchluessel('Weiß')).toBe(nameSchluessel('Weiss'));
  });

  it('unterscheidet verschiedene Namen', () => {
    expect(nameSchluessel('Anna Müller') === nameSchluessel('Anna Meier')).toBe(false);
  });
});

describe('findeNamensdublette', () => {
  const bestand = [
    neuesMitglied('Anna Müller', 'aktiv', '2025-01-01'),
    neuesMitglied('Bert Meier', 'passiv', '2025-01-01'),
  ];

  it('findet Schreibvarianten', () => {
    expect(findeNamensdublette(bestand, 'anna mueller')?.name).toBe('Anna Müller');
  });

  it('meldet nichts bei neuem Namen', () => {
    expect(findeNamensdublette(bestand, 'Clara Schmidt')).toBe(undefined);
  });

  it('schließt das Mitglied selbst aus', () => {
    // Sonst könnte man ein Mitglied nicht auf seinen eigenen Namen
    // umbenennen, etwa um nur die Schreibweise zu korrigieren.
    const anna = bestand[0];
    expect(findeNamensdublette(bestand, 'Anna Müller', anna.id)).toBe(undefined);
  });

  it('erkennt eine Kollision mit einem anderen Mitglied beim Umbenennen', () => {
    const anna = bestand[0];
    expect(findeNamensdublette(bestand, 'Bert Meier', anna.id)?.name).toBe('Bert Meier');
  });
});
