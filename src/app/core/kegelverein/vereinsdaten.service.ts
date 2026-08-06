import { Injectable, computed, inject, signal } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { FileStorageService } from './persistenz/file-storage.service';
import { KegeljahrRef } from './persistenz/file-storage.models';

export type LadeStatus = 'leer' | 'laedt' | 'bereit' | 'fehler';

/**
 * Bindeglied zwischen Persistenz (Server) und Zustand (KegeljahrStore).
 *
 * Beim Start wird nur das aktuelle Kegeljahr geladen, nicht alle — ältere
 * Jahre sind Archiv und werden erst beim Wechsel nachgeladen. Die Liste
 * aller verfügbaren Jahre kommt aus dem Manifest und ist dadurch trotzdem
 * sofort für einen Jahres-Umschalter verfügbar.
 *
 * Gespeichert wird bewusst nicht bei jeder Änderung, sondern auf Befehl
 * (speichern()): jeder Schreibvorgang legt serverseitig ein Backup an, und
 * das bei jedem Tastendruck zu tun würde die Rotation sinnlos machen.
 */
@Injectable({ providedIn: 'root' })
export class VereinsdatenService {
  private readonly store = inject(KegeljahrStore);
  private readonly storage = inject(FileStorageService);

  private readonly _status = signal<LadeStatus>('leer');
  private readonly _verfuegbareJahre = signal<KegeljahrRef[]>([]);
  private readonly _ungespeichert = signal(false);
  private readonly _fehler = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly verfuegbareJahre = this._verfuegbareJahre.asReadonly();
  readonly ungespeichert = this._ungespeichert.asReadonly();
  readonly fehler = this._fehler.asReadonly();

  readonly aktuellesJahr = computed(() => this.store.aktuellesKegeljahr());

  /** Nach hergestellter Serververbindung aufrufen. */
  async initialisieren(): Promise<void> {
    this._status.set('laedt');
    this._fehler.set(null);

    try {
      const manifest = await this.storage.manifestLaden();
      this._verfuegbareJahre.set(manifest.kegeljahre);

      const ref =
        manifest.kegeljahre.find((k) => k.id === manifest.aktuellesKegeljahrId) ??
        manifest.kegeljahre[manifest.kegeljahre.length - 1];

      if (!ref) {
        // Frischer Server ohne Daten — kein Fehler, nur noch nichts da.
        this.store.setKegeljahre([]);
        this._status.set('bereit');
        return;
      }

      const kegeljahr = await this.storage.kegeljahrLaden(ref.datei);
      this.store.setKegeljahre([kegeljahr], kegeljahr.id);
      this._ungespeichert.set(false);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden');
      this._status.set('fehler');
    }
  }

  /** Wechselt das aktive Kegeljahr und lädt es bei Bedarf nach. */
  async kegeljahrWechseln(id: string): Promise<void> {
    if (this.store.kegeljahre().some((kj) => kj.id === id)) {
      this.store.setAktuellesKegeljahr(id);
      return;
    }

    const ref = this._verfuegbareJahre().find((k) => k.id === id);
    if (!ref) throw new Error(`Kegeljahr ${id} ist im Manifest nicht verzeichnet.`);

    this._status.set('laedt');
    try {
      const kegeljahr = await this.storage.kegeljahrLaden(ref.datei);
      this.store.addKegeljahr(kegeljahr);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Kegeljahr konnte nicht geladen werden');
      this._status.set('fehler');
    }
  }

  /** Von Komponenten nach jeder Änderung aufzurufen (markiert nur, speichert nicht). */
  aenderungVorgemerkt(): void {
    this._ungespeichert.set(true);
  }

  async speichern(): Promise<void> {
    const kj = this.store.aktuellesKegeljahr();
    if (!kj) return;

    this._fehler.set(null);
    try {
      await this.storage.kegeljahrSpeichern(kj);
      await this.storage.aktuellesKegeljahrSetzen(kj.id);
      this._ungespeichert.set(false);
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      throw e;
    }
  }
}
