import { computed, inject, signal, Service } from '@angular/core';
import { FileStorageService } from './persistenz/file-storage.service';
import { KegeljahrStore } from './kegeljahr.store';
import { Kegeltermin } from './kegelverein.models';
import { neueAbmeldung, neuerTermin, sortiereTermine } from './termin.logic';

export type TerminStatus = 'leer' | 'laedt' | 'bereit' | 'fehler';

/**
 * Terminplanung — unabhängig von Buchführung und Kegeljahr.
 *
 * Anders als die übrigen Bereiche wird hier bei jeder Änderung sofort
 * gespeichert: Die Planung ist ein geteiltes Arbeitsmittel, bei dem ein
 * Zwischenstand im Browser niemandem nützt. Wer sich abmeldet, erwartet,
 * dass es sofort gilt.
 *
 * Damit die Anzeige nicht vom Server abweicht, wenn das Schreiben
 * fehlschlägt, wird die Änderung erst danach in den Zustand übernommen.
 */
@Service()
export class TerminService {
  private readonly storage = inject(FileStorageService);
  private readonly store = inject(KegeljahrStore);

  private readonly _termine = signal<Kegeltermin[]>([]);
  private readonly _status = signal<TerminStatus>('leer');
  private readonly _fehler = signal<string | null>(null);
  private readonly _speichert = signal(false);

  readonly status = this._status.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  readonly speichert = this._speichert.asReadonly();

  /** Anstehende Termine zuerst, danach die vergangenen absteigend. */
  readonly termine = computed(() => sortiereTermine(this._termine()));

  naechsterTermin(): Kegeltermin | null {
    if (this.termine().length === 0) {
      return null;
    }

    return this.termine()[0];
  }

  async laden(): Promise<void> {
    this._status.set('laedt');
    this._fehler.set(null);

    try {
      // Ohne Prüfung gegen die Mitglieder laden: Sind sie noch nicht da,
      // wäre die Termindatei sonst unlesbar.
      this._termine.set((await this.storage.termineLaden()) ?? []);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Termine konnten nicht geladen werden');
      this._status.set('fehler');
    }
  }

  // --- Termine ---------------------------------------------------------

  async terminAnlegen(beginn: string, ort?: string, notiz?: string): Promise<void> {
    await this.schreibe([...this._termine(), neuerTermin(beginn, ort, notiz)]);
  }

  async terminAendern(termin: Kegeltermin): Promise<void> {
    await this.schreibe(this._termine().map((t) => (t.id === termin.id ? termin : t)));
  }

  async terminLoeschen(id: string): Promise<void> {
    await this.schreibe(this._termine().filter((t) => t.id !== id));
  }

  // --- Abmeldungen -----------------------------------------------------

  /**
   * Meldet ein Mitglied ab. Eine bestehende Abmeldung wird ersetzt, damit
   * ein zweiter Versuch den Grund aktualisiert statt einen Widerspruch zu
   * erzeugen.
   */
  async abmelden(terminId: string, mitgliedId: string, grund: string): Promise<void> {
    await this.schreibe(
      this._termine().map((t) =>
        t.id === terminId
          ? {
              ...t,
              abmeldungen: [
                ...t.abmeldungen.filter((a) => a.mitgliedId !== mitgliedId),
                neueAbmeldung(mitgliedId, grund),
              ],
            }
          : t,
      ),
    );
  }

  /** Nimmt eine Abmeldung zurück — etwa wenn jemand doch kommt. */
  async abmeldungZuruecknehmen(terminId: string, mitgliedId: string): Promise<void> {
    await this.schreibe(
      this._termine().map((t) =>
        t.id === terminId
          ? { ...t, abmeldungen: t.abmeldungen.filter((a) => a.mitgliedId !== mitgliedId) }
          : t,
      ),
    );
  }

  /**
   * Spielt einen gesicherten Terminstand ein. Wie jede Änderung hier wird
   * er sofort geschrieben — der vorherige Stand landet dabei selbst als
   * Sicherung auf dem Server.
   */
  async sicherungUebernehmen(termine: Kegeltermin[]): Promise<void> {
    await this.schreibe(termine);
  }

  // ---------------------------------------------------------------------

  /**
   * Schreibt auf den Server und übernimmt den Stand erst bei Erfolg.
   * Schlägt es fehl, bleibt die Anzeige auf dem letzten gesicherten Stand.
   */
  private async schreibe(termine: Kegeltermin[]): Promise<void> {
    this._speichert.set(true);
    this._fehler.set(null);

    try {
      const ids = new Set(this.store.mitglieder().map((m) => m.id));
      await this.storage.termineSpeichern(termine, ids);
      this._termine.set(termine);
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      throw e;
    } finally {
      this._speichert.set(false);
    }
  }
}
