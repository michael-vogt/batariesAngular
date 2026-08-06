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
  stats: {
    verspaetung: number;
    pumpen: number;
    neuner: number;
    eingeholt: number;
    schnaps: number;
  };
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

  const kegeljahre = legacy.kegeljahre.map((kj) => mapKegeljahr(kj, warnungen));

  // Bug in der Legacy-App: currentKegeljahrId war oft number, kegeljahr.id string.
  // Hier konsequent auf string normalisieren, sonst matcht die Zuordnung nie.
  const aktuellesKegeljahrId = String(legacy.currentKegeljahrId);
  if (!kegeljahre.some((kj) => kj.id === aktuellesKegeljahrId)) {
    warnungen.push(
      `currentKegeljahrId "${aktuellesKegeljahrId}" referenziert kein vorhandenes Kegeljahr.`,
    );
  }

  return { kegeljahre, aktuellesKegeljahrId, warnungen };
}

function mapKegeljahr(kj: LegacyKegeljahr, warnungen: string[]): Kegeljahr {
  const mitglieder: Mitglied[] = kj.mitglieder.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    rolle: m.role || undefined,
  }));

  const mitgliedNachName = new Map(mitglieder.map((m) => [m.name, m]));

  return {
    id: String(kj.id),
    bezeichnung:
      kj.name ?? `Kegeljahr ${normalizeDatum(kj.startDatum)}–${normalizeDatum(kj.endDatum)}`,
    startDatum: normalizeDatum(kj.startDatum),
    endDatum: normalizeDatum(kj.endDatum),
    mitglieder,
    buchungen: kj.buchungen.map((b) => mapBuchung(b, mitgliedNachName, warnungen)),
    kegelabende: kj.kegelabende.map((ka) => mapKegelabend(ka, mitgliedNachName, warnungen)),
  };
}

function mapBuchung(
  b: LegacyBuchung,
  mitgliedNachName: Map<string, Mitglied>,
  warnungen: string[],
): Buchung {
  const mitgliedId = findeMitgliedInText(b.buchungstext, mitgliedNachName);
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
function findeMitgliedInText(
  text: string,
  mitgliedNachName: Map<string, Mitglied>,
): string | undefined {
  const namenAbsteigendNachLaenge = [...mitgliedNachName.keys()].sort(
    (a, b) => b.length - a.length,
  );
  const treffer = namenAbsteigendNachLaenge.find((name) => text.includes(name));
  return treffer ? mitgliedNachName.get(treffer)!.id : undefined;
}

function istPersonenbezogenerText(text: string): boolean {
  return text.includes(';');
}

function mapKegelabend(
  ka: LegacyKegelabend,
  mitgliedNachName: Map<string, Mitglied>,
  warnungen: string[],
): Kegelabend {
  const teilnehmer: KegelabendTeilnehmer[] = ka.players.map((p, index) => {
    const mitglied = mitgliedNachName.get(p.name);
    if (!mitglied && !p.isGuest) {
      warnungen.push(
        `Kegelabend ${ka.id}: Teilnehmer "${p.name}" nicht in Mitgliederliste gefunden.`,
      );
    }
    return {
      id: mitglied?.id ?? `gast_${ka.id}_${index}`,
      name: p.name,
      istGast: p.isGuest,
      anwesend: p.present,
      verspaetungStunden: p.stats.verspaetung,
      pumpen: p.stats.pumpen,
      neuner: p.stats.neuner,
      eingeholt: p.stats.eingeholt,
      schnaps: p.stats.schnaps,
    };
  });

  // players[i] <-> states[i] war positionsbasiert: hier explizit auf teilnehmer.id auflösen.
  const idNachIndex = teilnehmer.map((t) => t.id);

  const runden: Partial<Record<SpielKey, SpielRunde[]>> = {};
  for (const [spielKey, legacyRunden] of Object.entries(ka.rounds)) {
    runden[spielKey as SpielKey] = legacyRunden.map((r) => ({
      id: r.id,
      notiz: r.notes || undefined,
      ergebnisse: Object.fromEntries(
        r.states.map((status, index) => [
          idNachIndex[index],
          STATUS_MAP[status] ?? 'nicht_teilgenommen',
        ]),
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
      const nameNachId = new Map(neu.teilnehmer.map((t) => [t.id, t.name]));

      for (const zeile of zeilen) {
        const passend = berechnet.find((b) => nameNachId.get(b.teilnehmerId) === zeile.name);
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
