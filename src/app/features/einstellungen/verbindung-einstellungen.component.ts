import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhpApiAdapter } from '../../core/kegelverein/persistenz/php-api-adapter';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';

/**
 * Einmalige Eingabe der Serverzugangsdaten. Nach erfolgreichem Test
 * merkt sich PhpApiAdapter die Daten im localStorage, sodass dieses
 * Formular danach nur noch zum Ändern/Trennen gebraucht wird.
 */
@Component({
  selector: 'app-verbindung-einstellungen',
  imports: [FormsModule],
  template: `
    <section class="verbindung">
      <h2>Serververbindung</h2>

      @if (storage.status() === 'verbunden') {
        <p class="ok">Verbunden mit {{ baseUrl() }}</p>
        <button type="button" (click)="trennen()">Verbindung trennen</button>
      } @else {
        <label>
          API-Adresse
          <input
            type="url"
            name="baseUrl"
            placeholder="https://verein.example.org/api.php"
            [ngModel]="baseUrl()"
            (ngModelChange)="baseUrl.set($event)"
          />
        </label>

        <label>
          API-Key
          <input
            type="password"
            name="apiKey"
            autocomplete="current-password"
            [ngModel]="apiKey()"
            (ngModelChange)="apiKey.set($event)"
          />
        </label>

        <button type="button" [disabled]="laeuft()" (click)="verbinden()">
          {{ laeuft() ? 'Verbinde…' : 'Verbinden' }}
        </button>

        @if (fehler()) {
          <p class="fehler">{{ fehler() }}</p>
        }
      }
    </section>
  `,
})
export class VerbindungEinstellungenComponent {
  private readonly adapter = inject(PhpApiAdapter);
  protected readonly storage = inject(FileStorageService);

  protected readonly baseUrl = signal('');
  protected readonly apiKey = signal('');
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);

  protected async verbinden(): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);

    try {
      const ok = await this.adapter.verbinden({
        baseUrl: this.baseUrl(),
        apiKey: this.apiKey(),
      });

      if (!ok) {
        this.fehler.set('Verbindung fehlgeschlagen — Adresse und API-Key prüfen.');
        return;
      }

      // Übernimmt den Status in den FileStorageService und legt
      // manifest.json an, falls der Server noch leer ist.
      await this.storage.verbindungUebernehmen();
      this.apiKey.set('');
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected trennen(): void {
    this.adapter.trennen();
    this.storage.verbindungGetrennt();
  }
}
