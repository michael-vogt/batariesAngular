/**
 * Kegelverein Verwaltung — Ziel-Datenmodell für Angular-Reimplementierung
 * ------------------------------------------------------------------------
 * Bereinigt gegenüber der Legacy-App:
 *  - Buchung/Runde referenzieren Mitglieder über `id`, nicht über Namens-
 *    Substring im Freitext bzw. Array-Index.
 *  - Rein abgeleitete Werte (Salden, Forderungen, Restguthaben, Spielstatistik)
 *    werden NICHT gespeichert, sondern als Selectors/computed() aus den
 *    Rohdaten berechnet (Abschnitt "Abgeleitete Werte" unten).
 *  - Datum konsequent als ISO-String (Angular/Backend-freundlich, sortierbar).
 */

// =====================================================================
// 1. Kontenrahmen (statische Stammdaten, kein CRUD nötig)
// =====================================================================

export type KontoNummer =
  | '000'
  | '100'
  | '110'
  | '200'
  | '210'
  | '220'
  | '250'
  | '300'
  | '310'
  | '320'
  | '330'
  | '400'
  | '410'
  | '420'
  | '430';

export type KontoArt = 'Sonstige' | 'Aktiv' | 'Passiv' | 'Ertrag' | 'Aufwand' | 'GuV';

export interface Konto {
  nummer: KontoNummer;
  name: string;
  art: KontoArt;
}

export const KONTENRAHMEN: readonly Konto[] = [
  { nummer: '000', name: 'Eröffnungsbilanzkonto', art: 'Sonstige' },
  { nummer: '100', name: 'Forderungen', art: 'Aktiv' },
  { nummer: '110', name: 'Kasse', art: 'Aktiv' },
  { nummer: '200', name: 'Vereinsvermögen', art: 'Sonstige' },
  { nummer: '210', name: 'Restguthaben', art: 'Passiv' },
  { nummer: '220', name: 'Schulden ggü. Dritten', art: 'Passiv' },
  { nummer: '250', name: 'GuV-Konto', art: 'GuV' },
  { nummer: '300', name: 'Beiträge', art: 'Ertrag' },
  { nummer: '310', name: 'Strafen', art: 'Ertrag' },
  { nummer: '320', name: 'Umlagen', art: 'Ertrag' },
  { nummer: '330', name: 'Sonstige Erträge', art: 'Ertrag' },
  { nummer: '400', name: 'Kegelbahn', art: 'Aufwand' },
  { nummer: '410', name: 'Vereinsrunden', art: 'Aufwand' },
  { nummer: '420', name: 'Generalversammlung', art: 'Aufwand' },
  { nummer: '430', name: 'Sonstige Aufwendungen', art: 'Aufwand' },
] as const;

// =====================================================================
// 2. Mitglied
// =====================================================================

export type MitgliedStatus = 'aktiv' | 'passiv';

export interface Mitglied {
  id: string;
  name: string;
  status: MitgliedStatus;
  /** Vereinsamt, freier Text, optional (z.B. "Präsident", "zbV", "Kasse & Schriftführer") */
  rolle?: string;
}

// =====================================================================
// 3. Buchung (Journal-Eintrag, doppelte Buchführung)
// =====================================================================

export interface Buchung {
  id: string;
  /** ISO-Datum, z.B. "2025-11-07" */
  datum: string;
  sollKonto: KontoNummer;
  habenKonto: KontoNummer;
  betrag: number;
  buchungstext: string;
  /** Explizite Zuordnung statt Namens-Parsing aus buchungstext (Legacy-Problem) */
  mitgliedId?: string;
}

// =====================================================================
// 4. Kegelabend
// =====================================================================

export type SpielKey =
  | 'abraeumen'
  | 'christbaum'
  | 'fuchsjagd'
  | 'hohe'
  | 'koenig'
  | 'niedrige'
  | 'regenundsonne'
  | 'siebzehn'
  | 'totenkiste'
  | 'viergewinnt';

export type SpielStatus = 'teilgenommen' | 'gewonnen' | 'verloren' | 'nicht_teilgenommen';

export interface KegelabendTeilnehmer {
  /** = Mitglied.id bei Vereinsmitgliedern, sonst generierte Gast-ID */
  id: string;
  name: string;
  istGast: boolean;
  anwesend: boolean;
  verspaetungStunden: number;
  pumpen: number;
  neuner: number;
  eingeholt: number;
  schnaps: number;
}

export interface SpielRunde {
  id: string;
  /** Ergebnis pro Teilnehmer, Schlüssel = KegelabendTeilnehmer.id (statt Array-Index) */
  ergebnisse: Record<string, SpielStatus>;
  notiz?: string;
}

export interface Kegelabend {
  id: string;
  datum: string;
  ort?: string;
  teilnehmer: KegelabendTeilnehmer[];
  runden: Partial<Record<SpielKey, SpielRunde[]>>;
}

// =====================================================================
// 5. Strafsätze (konfigurierbare Geschäftsregeln, keine Konstanten im Code)
// =====================================================================

export interface Strafsaetze {
  verspaetungProStunde: number;
  pumpe: number;
  teilnahme: number;
  /** Fuchsjagd: Teilnahme in einer Runde, die einen Sieger hatte. */
  fuchsjagdTeilnahmeMitSieger: number;
  niederlageStandard: number;
  niederlageFuchsjagdTotenkiste: number;
}

export const STANDARD_STRAFSAETZE: Strafsaetze = {
  verspaetungProStunde: 1.0,
  pumpe: 0.1,
  teilnahme: 0.1,
  fuchsjagdTeilnahmeMitSieger: 0.25,
  niederlageStandard: 0.25,
  niederlageFuchsjagdTotenkiste: 0.5,
};

// =====================================================================
// 6. Kegeljahr — Aggregatwurzel
// =====================================================================

export interface Kegeljahr {
  id: string;
  /** z.B. "2025/2026" */
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
  mitglieder: Mitglied[];
  buchungen: Buchung[];
  kegelabende: Kegelabend[];
}

// =====================================================================
// 7. Persistenz-Root
// =====================================================================

export interface VereinsDaten {
  kegeljahre: Kegeljahr[];
  aktuellesKegeljahrId: string;
}

// =====================================================================
// 8. Abgeleitete Werte — NICHT persistieren, per Selector/computed() erzeugen
// =====================================================================

export interface KontoSaldo {
  soll: number;
  haben: number;
}

export type Salden = Record<KontoNummer, KontoSaldo>;

export interface MitgliedFinanzen {
  mitgliedId: string;
  offeneBeitraege: number;
  offeneStrafen: number;
  offeneUmlagen: number;
  offeneForderungenGesamt: number;
  restguthaben: number;
}

export interface KegelabendErgebnisZeile {
  teilnehmerId: string;
  siege: number;
  niederlagen: number;
  bilanz: number;
  strafeGesamt: number;
}
