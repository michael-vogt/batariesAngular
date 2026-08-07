import {
  Buchung,
  Kegelabend,
  KegelabendTeilnehmer,
  Kegeljahr,
  KontoNummer,
  Mitglied,
  SpielKey,
  SpielRunde,
  SpielStatus,
} from '../kegelverein.models';
import { berechneKegelabendErgebnisse } from '../kegelabend.logic';
import { nameSchluessel } from '../namen.util';
import { neuesMitglied } from '../mitglied.util';

/**
 * Wandelt einen Export der Legacy-App (version "1.0"/"2.0", flacher
 * Namens-Bezug statt mitgliedId, positionsbasierte states[]) in das
 * neue Zielmodell um. Nur für einmaligen Import bestehender Vereinsdaten
 * gedacht — danach läuft die App ausschließlich mit dem neuen Format.
 */

interface LegacyMitglied {
  id: string;
  name: string;
  status: 'aktiv' | 'passiv';
  role?: string;
}

interface LegacyBuchung {
  id: string | number;
  datum: string | number;
  sollKonto: string;
  habenKonto: string;
  betrag: number;
  buchungstext: string;
}

interface LegacySpieler {
  name: string;
  role?: string;
  isGuest: boolean;
  present: boolean;
  stats: { verspaetung: number; pumpen: number; neuner: number; eingeholt: number; schnaps: number };
}

interface LegacyRunde {
  id: string;
  played?: boolean;
  states: string[];
  notes: string;
}

interface LegacySummaryRow {
  name: string;
  siege: number;
  niederlagen: number;
  strafe: number;
}

interface LegacyKegelabend {
  id: string;
  datum: string;
  ort: string | null;
  players: LegacySpieler[];
  rounds: Record<string, LegacyRunde[]>;
  summary?: { rows: LegacySummaryRow[] }; // wird bewusst verworfen, siehe unten
}

interface LegacyKegeljahr {
  id: string | number;
  name?: string;
  startDatum: string;
  endDatum: string;
  buchungen: LegacyBuchung[];
  mitglieder: LegacyMitglied[];
  kegelabende: LegacyKegelabend[];
}

interface LegacyExport {
  version: string;
  kegeljahre: LegacyKegeljahr[];
  currentKegeljahrId: string | number;
}

export interface ImportErgebnis {
  /** Vereinsweite Stammdaten, aus allen Jahren zusammengeführt. */
  mitglieder: Mitglied[];
  kegeljahre: Kegeljahr[];
  aktuellesKegeljahrId: string;
  warnungen: string[];
}

const STATUS_MAP: Record<string, SpielStatus> = {
  winner: 'gewonnen',
  loser: 'verloren',
  participated: 'teilgenommen',
  not_participated: 'nicht_teilgenommen',
};

export function importiereLegacyExport(json: unknown): ImportErgebnis {
  const legacy = json as LegacyExport;
  const warnungen: string[] = [];

  // Mitglieder werden über alle Jahre hinweg in einer Map gesammelt, damit
  // dieselbe Person nicht je Jahr erneut angelegt wird. Statuswechsel
  // zwischen den Jahren landen als Verlaufseinträge auf demselben Mitglied.
  const stamm = new Map<string, Mitglied>();
  const chronologisch = [...legacy.kegeljahre].sort((a, b) =>
    String(a.startDatum).localeCompare(String(b.startDatum)),
  );

  const kegeljahre = chronologisch.map(kj => mapKegeljahr(kj, stamm, warnungen));

  // Bug in der Legacy-App: currentKegeljahrId war oft number, kegeljahr.id string.
  // Hier konsequent auf string normalisieren, sonst matcht die Zuordnung nie.
  const aktuellesKegeljahrId = String(legacy.currentKegeljahrId);
  if (!kegeljahre.some(kj => kj.id === aktuellesKegeljahrId)) {
    warnungen.push(
      `currentKegeljahrId "${aktuellesKegeljahrId}" referenziert kein vorhandenes Kegeljahr.`,
    );
  }

  return { mitglieder: [...stamm.values()], kegeljahre, aktuellesKegeljahrId, warnungen };
}

function mapKegeljahr(
  kj: LegacyKegeljahr,
  stamm: Map<string, Mitglied>,
  warnungen: string[],
): Kegeljahr {
  const start = normalizeDatum(kj.startDatum);

  /** Legt an oder ergänzt einen Statuswechsel am bestehenden Eintrag. */
  const erfasse = (name: string, status: Mitglied['statusVerlauf'][number]['status'], rolle?: string) => {
    const schluessel = nameSchluessel(name);
    const vorhanden = stamm.get(schluessel);

    if (!vorhanden) {
      const m = neuesMitglied(name.trim(), status, start, rolle);
      stamm.set(schluessel, m);
      return m;
    }

    const letzter = vorhanden.statusVerlauf[vorhanden.statusVerlauf.length - 1];
    if (letzter.status !== status) {
      vorhanden.statusVerlauf.push({ ab: start, status, notiz: 'Wechsel aus Altdaten erschlossen' });
      warnungen.push(
        `${vorhanden.name}: Statuswechsel ${letzter.status} → ${status} zum ${start} erschlossen.`,
      );
    }
    if (rolle && !vorhanden.rolle) vorhanden.rolle = rolle;
    return vorhanden;
  };

  for (const m of kj.mitglieder) erfasse(m.name, m.status, m.role || undefined);

  // Gäste aus den Spielabenden werden zu Mitgliedern mit Status 'gastkegler',
  // damit Teilnehmer-IDs auflösbar sind und ihre Strafen buchbar werden.
  for (const legacyKa of kj.kegelabende) {
    for (const spieler of legacyKa.players) {
      if (!spieler.isGuest || stamm.has(nameSchluessel(spieler.name))) continue;
      const gast = erfasse(spieler.name, 'gastkegler');
      warnungen.push(`Gastkegler „${gast.name}“ aus Spielabenden als Mitglied angelegt.`);
    }
  }

  return {
    id: String(kj.id),
    bezeichnung: kj.name ?? `Kegeljahr ${start}–${normalizeDatum(kj.endDatum)}`,
    startDatum: start,
    endDatum: normalizeDatum(kj.endDatum),
    buchungen: kj.buchungen.map(b => mapBuchung(b, stamm, warnungen)),
    kegelabende: kj.kegelabende.map(ka => mapKegelabend(ka, stamm, warnungen)),
  };
}

function mapBuchung(
  b: LegacyBuchung,
  stamm: Map<string, Mitglied>,
  warnungen: string[],
): Buchung {
  const mitgliedId = findeMitgliedInText(b.buchungstext, stamm);
  if (!mitgliedId && istPersonenbezogenerText(b.buchungstext)) {
    warnungen.push(`Buchung ${b.id}: kein Mitglied im Text "${b.buchungstext}" gefunden.`);
  }

  return {
    id: String(b.id),
    datum: normalizeDatum(b.datum),
    sollKonto: b.sollKonto as KontoNummer,
    habenKonto: b.habenKonto as KontoNummer,
    betrag: b.betrag,
    buchungstext: b.buchungstext,
    mitgliedId,
  };
}

/** Sucht den längsten passenden Mitgliedsnamen im Freitext (vermeidet Fehltreffer bei Teilnamen). */
function findeMitgliedInText(text: string, mitgliedNachName: Map<string, Mitglied>): string | undefined {
  const mitglieder = [...mitgliedNachName.values()].sort((a, b) => b.name.length - a.name.length);
  const treffer = mitglieder.find(m => text.includes(m.name));
  return treffer?.id;
}

function istPersonenbezogenerText(text: string): boolean {
  return text.includes(';');
}

function mapKegelabend(
  ka: LegacyKegelabend,
  stamm: Map<string, Mitglied>,
  warnungen: string[],
): Kegelabend {
  const teilnehmer: KegelabendTeilnehmer[] = ka.players.map(p => {
    const mitglied = stamm.get(nameSchluessel(p.name));
    if (!mitglied) {
      // Sollte nach der Gastkegler-Anlage in mapKegeljahr nicht mehr vorkommen.
      warnungen.push(`Kegelabend ${ka.id}: Teilnehmer "${p.name}" konnte nicht zugeordnet werden.`);
    }
    return {
      id: mitglied?.id ?? `unbekannt_${ka.id}_${p.name}`,
      name: p.name,
      anwesend: p.present,
      verspaetungStunden: p.stats.verspaetung,
      pumpen: p.stats.pumpen,
      neuner: p.stats.neuner,
      eingeholt: p.stats.eingeholt,
      schnaps: p.stats.schnaps,
    };
  });

  // players[i] <-> states[i] war positionsbasiert: hier explizit auf teilnehmer.id auflösen.
  const idNachIndex = teilnehmer.map(t => t.id);

  const runden: Partial<Record<SpielKey, SpielRunde[]>> = {};
  for (const [spielKey, legacyRunden] of Object.entries(ka.rounds)) {
    runden[spielKey as SpielKey] = legacyRunden.map(r => ({
      id: r.id,
      notiz: r.notes || undefined,
      ergebnisse: Object.fromEntries(
        r.states.map((status, index) => [idNachIndex[index], STATUS_MAP[status] ?? 'nicht_teilgenommen']),
      ),
    }));
  }

  // summary wird bewusst NICHT übernommen — nach dem Import per
  // berechneKegelabendErgebnisse() aus teilnehmer/runden neu berechnen.
  // So werden Legacy-Inkonsistenzen zwischen gespeichertem summary und
  // den Rohdaten beim Import automatisch aufgedeckt statt fortgeschrieben.

  return {
    id: ka.id,
    datum: normalizeDatum(ka.datum),
    ort: ka.ort ?? undefined,
    teilnehmer,
    runden,
  };
}

function normalizeDatum(d: string | number): string {
  if (typeof d === 'number') return new Date(d).toISOString().slice(0, 10);
  return d.length > 10 ? d.slice(0, 10) : d;
}

/**
 * Vergleicht die beim Import verworfenen summary-Werte der Legacy-Daten
 * mit den aus den Rohdaten (Runden + Teilnehmerstatistik) neu berechneten
 * Ergebnissen.
 *
 * Beide müssten identisch sein — Abweichungen bedeuten, dass die
 * gespeicherte Zusammenfassung in den Altdaten bereits nicht mehr zu den
 * zugrundeliegenden Runden passte. Das ist kein Importfehler, sondern ein
 * Fund: die neu berechneten Werte sind die korrekten, aber es lohnt sich
 * zu wissen, welche Abende betroffen sind (z.B. weil daraus schon Strafen
 * verbucht wurden).
 */
export function pruefeSummaryAbweichungen(json: unknown, kegeljahre: Kegeljahr[]): string[] {
  const legacy = json as LegacyExport;
  const abweichungen: string[] = [];

  const neuNachId = new Map<string, Kegelabend>();
  for (const kj of kegeljahre) {
    for (const ka of kj.kegelabende) neuNachId.set(ka.id, ka);
  }

  for (const legacyKj of legacy.kegeljahre) {
    for (const legacyKa of legacyKj.kegelabende) {
      const zeilen = legacyKa.summary?.rows;
      const neu = neuNachId.get(legacyKa.id);
      if (!zeilen || !neu) continue;

      const berechnet = berechneKegelabendErgebnisse(neu);
      const nameNachId = new Map(neu.teilnehmer.map(t => [t.id, t.name]));

      for (const zeile of zeilen) {
        const passend = berechnet.find(b => nameNachId.get(b.teilnehmerId) === zeile.name);
        if (!passend) continue;

        // Centbeträge: kleine Rundungsdifferenzen nicht als Abweichung melden.
        if (Math.abs(passend.strafeGesamt - zeile.strafe) > 0.005) {
          abweichungen.push(
            `Kegelabend ${legacyKa.datum}, ${zeile.name}: Strafe gespeichert ${zeile.strafe.toFixed(2)} €, ` +
              `neu berechnet ${passend.strafeGesamt.toFixed(2)} €`,
          );
        }
        if (passend.siege !== zeile.siege || passend.niederlagen !== zeile.niederlagen) {
          abweichungen.push(
            `Kegelabend ${legacyKa.datum}, ${zeile.name}: Bilanz gespeichert ${zeile.siege}/${zeile.niederlagen}, ` +
              `neu berechnet ${passend.siege}/${passend.niederlagen}`,
          );
        }
      }
    }
  }

  return abweichungen;
}
