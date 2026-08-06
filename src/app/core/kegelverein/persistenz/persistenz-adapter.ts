/**
 * Abstraktion über den Datenzugriff. FileStorageService kennt nur dieses
 * Interface, nicht die konkrete Implementierung (PhpApiAdapter).
 *
 * Auch bei aktuell nur einer Implementierung bleibt die Abstraktion
 * sinnvoll: In Tests lässt sich der Adapter durch ein In-Memory-Fake
 * ersetzen, sodass Backup-Rotation und Validierung ohne laufenden
 * Webserver testbar sind.
 */
export interface PersistenzAdapter {
  /** Versucht, eine zuvor gespeicherte Verbindung stillschweigend zu reaktivieren. */
  verbindungWiederherstellen(): Promise<boolean>;

  /** true, sobald eine nutzbare Verbindung besteht. */
  hatVerbindung(): boolean;

  /** Liest eine Textdatei relativ zum Datenverzeichnis, null falls nicht vorhanden. */
  dateiLesen(pfad: string): Promise<string | null>;

  /** Schreibt eine Textdatei relativ zum Datenverzeichnis, legt Unterordner bei Bedarf an. */
  dateiSchreiben(pfad: string, inhalt: string): Promise<void>;

  /** Listet Dateinamen (ohne Pfad) in einem Unterordner relativ zum Datenverzeichnis. */
  dateiListen(ordnerPfad: string): Promise<string[]>;

  /** Löscht eine Datei relativ zum Datenverzeichnis, ignoriert falls nicht vorhanden. */
  dateiLoeschen(pfad: string): Promise<void>;
}
