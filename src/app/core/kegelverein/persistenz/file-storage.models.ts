import { Kegeljahr, Mitglied } from '../kegelverein.models';

/**
 * Schema-Version des Dateiformats.
 *
 * 1: Mitglieder lagen als Kopie in jeder Kegeljahr-Datei, Status war ein
 *    einzelner Wert.
 * 2: Mitglieder liegen vereinsweit in mitglieder.json, Status als Verlauf.
 *    Migration siehe file-storage.migration.ts.
 */
export const SCHEMA_VERSION = 2 as const;

/** Dateiname der vereinsweiten Stammdaten, relativ zum Datenverzeichnis. */
export const MITGLIEDER_DATEI = 'mitglieder.json';

export interface KegeljahrRef {
  id: string;
  bezeichnung: string;
  /** Dateiname relativ zu kegeljahre/, z.B. "kegeljahr-2025-2026.json" */
  datei: string;
}

/** manifest.json im Wurzelverzeichnis */
export interface Manifest {
  schemaVersion: number;
  appName: 'BatariesVerwaltungApp';
  aktuellesKegeljahrId: string;
  kegeljahre: KegeljahrRef[];
}

/** mitglieder.json — vereinsweite Stammdaten, jahresübergreifend */
export interface MitgliederDatei {
  schemaVersion: number;
  mitglieder: Mitglied[];
}

/** kegeljahre/<jahr>.json — ein Kegeljahr pro Datei, ohne Mitglieder */
export interface KegeljahrDatei {
  schemaVersion: number;
  kegeljahr: Kegeljahr;
}

export function leeresManifest(): Manifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    appName: 'BatariesVerwaltungApp',
    aktuellesKegeljahrId: '',
    kegeljahre: [],
  };
}

/**
 * Erzeugt einen Dateinamen, der garantiert dem serverseitig erlaubten
 * Zeichensatz entspricht ([A-Za-z0-9_-] plus ".json"). Leerzeichen,
 * Umlaute und Sonderzeichen werden ersetzt bzw. entfernt — sonst weist
 * api.php den Pfad mit "Ungültiger Dateiname" zurück.
 *
 * Beispiel: "Kegeljahr 2025/2026" -> "kegeljahr-2025-2026.json"
 */
export function dateinameFuerKegeljahr(bezeichnung: string, fallbackId = 'kegeljahr'): string {
  const umlaute: Record<string, string> = {
    ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'ae', Ö: 'oe', Ü: 'ue', ß: 'ss',
  };

  const slug = bezeichnung
    .replace(/[äöüÄÖÜß]/g, treffer => umlaute[treffer])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || fallbackId}.json`;
}
