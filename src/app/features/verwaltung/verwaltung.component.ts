import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HauptnavigationComponent } from './hauptnavigation/hauptnavigation.component';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';

/**
 * Rahmen des Verwaltungsbereichs: Navigation plus Inhaltsbereich.
 *
 * Die Navigation sitzt hier und nicht in der Wurzelkomponente, weil sie
 * ausschließlich Verwaltungsseiten zeigt. Käme später ein Bereich ohne
 * diese Leiste dazu — etwa eine öffentliche Ansicht —, wäre dafür nichts
 * zu ändern.
 *
 * Ebenfalls hier: das Herstellen der Serververbindung beim Betreten des
 * Bereichs. Vorher lag es in der Wurzelkomponente und lief damit auch,
 * wenn gar keine Verwaltungsseite aufgerufen wurde.
 */
@Component({
  selector: 'app-verwaltung',
  imports: [RouterOutlet, HauptnavigationComponent],
  templateUrl: './verwaltung.component.html',
  styleUrl: '/verwaltung.component.scss'
})
export class VerwaltungComponent {
  private readonly storage = inject(FileStorageService);
  private readonly daten = inject(VereinsdatenService);

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
