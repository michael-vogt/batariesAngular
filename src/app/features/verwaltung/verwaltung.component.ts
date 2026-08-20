import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';

/**
 * Rahmen des Verwaltungsbereichs: stellt beim Betreten die Serververbindung
 * her und zeigt Lade-/Migrationshinweise. Die Navigation liegt in
 * RahmenComponent, da sie dort gemeinsam mit den übrigen Bereichen der App
 * als eine Sidebar erscheint.
 */
@Component({
  selector: 'app-verwaltung',
  imports: [RouterOutlet],
  templateUrl: './verwaltung.component.html',
  styleUrl: '/verwaltung.component.scss'
})
export class VerwaltungComponent {
  private readonly storage = inject(FileStorageService);
  protected readonly daten = inject(VereinsdatenService);

  constructor() {
    void this.verbinden();
  }

  /**
   * Reaktiviert eine gespeicherte Serververbindung und lädt die Daten.
   * Schlägt es fehl, bleibt der Status auf "nicht verbunden" — die
   * Navigation weist dann auf die Einstellungen hin.
   */
  private async verbinden(): Promise<void> {
    const verbunden = await this.storage.automatischVerbinden();
    if (verbunden) await this.daten.initialisieren();
  }
}
