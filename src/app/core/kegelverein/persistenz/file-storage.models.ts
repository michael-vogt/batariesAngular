import { Kegeljahr } from '../kegelverein.models';

/**
 * Aktuelle Schema-Version des eigenen (nicht-Legacy) Dateiformats.
 * Bei strukturellen Änderungen hochzählen + Migration in migrations.ts ergänzen.
 */
export const SCHEMA_VERSION = 1 as const;

export interface KegeljahrRef {
  id: string;
  bezeichnung: string;
  /** Dateiname relativ zu kegeljahre/, z.B. "2025-2026.json" */
  datei: string;
}

/** manifest.json im Wurzelverzeichnis */
export interface Manifest {
  schemaVersion: typeof SCHEMA_VERSION;
  appName: 'BatariesVerwaltungApp';
  aktuellesKegeljahrId: string;
  kegeljahre: KegeljahrRef[];
}

/** kegeljahre/<jahr>.json — ein Kegeljahr pro Datei */
export interface KegeljahrDatei {
  schemaVersion: typeof SCHEMA_VERSION;
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
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    Ä: 'ae',
    Ö: 'oe',
    Ü: 'ue',
    ß: 'ss',
  };

  const slug = bezeichnung
    .replace(/[äöüÄÖÜß]/g, (treffer) => umlaute[treffer])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // alles Übrige (inkl. Leerzeichen, "/") zu "-"
    .replace(/^-+|-+$/g, ''); // führende/abschließende Bindestriche weg

  return `${slug || fallbackId}.json`;
}
