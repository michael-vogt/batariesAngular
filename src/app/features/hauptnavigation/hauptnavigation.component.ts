import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';

interface NavPunkt {
  pfad: string;
  titel: string;
  /** true, wenn der Punkt nur bei exakter Übereinstimmung aktiv sein soll. */
  exakt?: boolean;
}

@Component({
  selector: 'app-hauptnavigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './hauptnavigation.component.html',
  styleUrl: './hauptnavigation.component.scss',
})
export class HauptnavigationComponent {
  protected readonly daten = inject(VereinsdatenService);
  protected readonly storage = inject(FileStorageService);

  protected readonly menueOffen = signal(false);
  protected readonly jahrWechselt = signal(false);

  protected readonly punkte: NavPunkt[] = [
    { pfad: '/mitglieder', titel: 'Mitglieder' },
    { pfad: '/kegelabende', titel: 'Kegelabende' },
    { pfad: '/buchfuehrung/journal', titel: 'Journal' },
    { pfad: '/buchfuehrung/vorfaelle', titel: 'Geschäftsvorfälle' },
    { pfad: '/buchfuehrung/konten', titel: 'Konten' },
    { pfad: '/abrechnung', titel: 'Abrechnung' },
    { pfad: '/buchfuehrung/abschluss', titel: 'Jahresabschluss' },
  ];

  protected readonly weitere: NavPunkt[] = [
    { pfad: '/import', titel: 'Altdaten importieren' },
    { pfad: '/einstellungen', titel: 'Einstellungen' },
  ];

  protected menueUmschalten(): void {
    this.menueOffen.update((offen) => !offen);
  }

  protected menueSchliessen(): void {
    this.menueOffen.set(false);
  }

  protected async jahrWechseln(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    if (!id || id === this.daten.aktuellesJahr()?.id) return;

    // Ungespeicherte Änderungen gingen beim Wechsel verloren, weil der
    // Store nur das geladene Jahr hält.
    if (this.daten.ungespeichert()) {
      const weiter = confirm(
        'Es gibt nicht gespeicherte Änderungen. Beim Wechsel des Kegeljahres gehen sie verloren. Trotzdem wechseln?',
      );
      if (!weiter) {
        (event.target as HTMLSelectElement).value = this.daten.aktuellesJahr()?.id ?? '';
        return;
      }
    }

    this.jahrWechselt.set(true);
    try {
      await this.daten.kegeljahrWechseln(id);
    } finally {
      this.jahrWechselt.set(false);
    }
  }
}
