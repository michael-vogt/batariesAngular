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

export function dateinameFuerKegeljahr(bezeichnung: string): string {
  // "2025/2026" -> "2025-2026.json"
  return `${bezeichnung.replace(/\//g, '-')}.json`;
}
