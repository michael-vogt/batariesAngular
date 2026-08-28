import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhpApiAdapter } from '../../../core/kegelverein/persistenz/php-api-adapter';
import { FileStorageService } from '../../../core/kegelverein/persistenz/file-storage.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';

/**
 * Einmalige Eingabe der Serverzugangsdaten. Nach erfolgreichem Test
 * merkt sich PhpApiAdapter die Daten im localStorage, sodass dieses
 * Formular danach nur noch zum Ändern/Trennen gebraucht wird.
 *
 * Direkt im Anschluss werden die Vereinsdaten geladen — sonst wären die
 * Feature-Seiten bis zum nächsten Neuladen der Anwendung leer.
 */
@Component({
  selector: 'app-verbindung-einstellungen',
  imports: [FormsModule],
  templateUrl: './verbindung-einstellungen.component.html',
  styleUrl: './verbindung-einstellungen.component.scss',
})
export class VerbindungEinstellungenComponent {
  protected readonly adapter = inject(PhpApiAdapter);
  protected readonly storage = inject(FileStorageService);
  protected readonly daten = inject(VereinsdatenService);

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

      // Danach die eigentlichen Vereinsdaten in den Store laden, damit
      // die Feature-Seiten ohne Neuladen der Anwendung nutzbar sind.
      await this.daten.initialisieren();

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
