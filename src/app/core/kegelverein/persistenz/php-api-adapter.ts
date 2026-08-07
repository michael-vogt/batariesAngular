import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PersistenzAdapter } from './persistenz-adapter';

const STORAGE_KEY = 'kegelverein-server-verbindung';

export interface ServerVerbindung {
  /** z.B. "https://verein.example.org/api.php" */
  baseUrl: string;
  apiKey: string;
}

/**
 * Implementiert PersistenzAdapter über HTTP gegen das PHP-Backend
 * (siehe deployment/api.php). Funktioniert in jedem Browser.
 *
 * Die Zugangsdaten (baseUrl + apiKey) kommen aus einem Einstellungen-
 * Formular und werden nach erfolgreichem Verbindungstest im localStorage
 * abgelegt, damit sie nicht bei jedem Seitenaufruf neu eingegeben
 * werden müssen.
 */
@Injectable({ providedIn: 'root' })
export class PhpApiAdapter implements PersistenzAdapter {
  private readonly http = inject(HttpClient);

  /**
   * Als Signal, damit die Oberfläche die tatsächlich aktive Verbindung
   * anzeigen kann — auch nach einem Neuladen, wenn sie aus dem
   * localStorage reaktiviert wurde und kein Formular ausgefüllt war.
   */
  private readonly _verbindung = signal<ServerVerbindung | null>(null);

  /** Adresse der aktiven Verbindung, leer wenn nicht verbunden. */
  readonly aktiveBaseUrl = computed(() => this._verbindung()?.baseUrl ?? '');

  hatVerbindung(): boolean {
    return this._verbindung() !== null;
  }

  async verbindungWiederherstellen(): Promise<boolean> {
    const gespeichert = localStorage.getItem(STORAGE_KEY);
    if (!gespeichert) return false;
    return this.verbinden(JSON.parse(gespeichert));
  }

  /** Aus einem Einstellungen-Formular aufzurufen (baseUrl + apiKey abfragen). */
  async verbinden(verbindung: ServerVerbindung): Promise<boolean> {
    const kandidat: ServerVerbindung = {
      ...verbindung,
      baseUrl: verbindung.baseUrl.replace(/\/$/, ''),
    };

    const erreichbar = await this.pruefeVerbindung(kandidat);
    if (!erreichbar) return false;

    this._verbindung.set(kandidat);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kandidat));
    return true;
  }

  trennen(): void {
    this._verbindung.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private async pruefeVerbindung(v: ServerVerbindung): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get(`${v.baseUrl}?pfad=manifest.json`, {
          headers: { 'X-Api-Key': v.apiKey },
          responseType: 'text',
        }),
      );
      return true;
    } catch (e) {
      // 404 ist ok — manifest.json existiert bei einer frischen Installation einfach noch nicht.
      // Alles andere (401 falscher Key, Netzwerkfehler, ...) heißt: Verbindung fehlgeschlagen.
      return e instanceof HttpErrorResponse && e.status === 404;
    }
  }

  private pruefeVerbunden(): ServerVerbindung {
    const v = this._verbindung();
    if (!v) throw new Error('Keine Serververbindung aktiv — zuerst verbinden() aufrufen.');
    return v;
  }

  async dateiLesen(pfad: string): Promise<string | null> {
    const v = this.pruefeVerbunden();
    try {
      return await firstValueFrom(
        this.http.get(`${v.baseUrl}?pfad=${encodeURIComponent(pfad)}`, {
          headers: { 'X-Api-Key': v.apiKey },
          responseType: 'text',
        }),
      );
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return null;
      throw e;
    }
  }

  async dateiSchreiben(pfad: string, inhalt: string): Promise<void> {
    const v = this.pruefeVerbunden();
    await firstValueFrom(
      this.http.put(`${v.baseUrl}?pfad=${encodeURIComponent(pfad)}`, inhalt, {
        headers: { 'X-Api-Key': v.apiKey, 'Content-Type': 'application/json' },
      }),
    );
  }

  async dateiListen(ordnerPfad: string): Promise<string[]> {
    const v = this.pruefeVerbunden();
    const antwort = await firstValueFrom(
      this.http.get<string[]>(`${v.baseUrl}?liste=${encodeURIComponent(ordnerPfad)}`, {
        headers: { 'X-Api-Key': v.apiKey },
      }),
    );
    return antwort ?? [];
  }

  async dateiLoeschen(pfad: string): Promise<void> {
    const v = this.pruefeVerbunden();
    await firstValueFrom(
      this.http.delete(`${v.baseUrl}?pfad=${encodeURIComponent(pfad)}`, {
        headers: { 'X-Api-Key': v.apiKey },
      }),
    );
  }
}
