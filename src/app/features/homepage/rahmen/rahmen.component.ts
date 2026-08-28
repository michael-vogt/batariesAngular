import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { FileStorageService } from '../../../core/kegelverein/persistenz/file-storage.service';
import { ThemaService } from '../../../core/thema.service';
import { AnmeldungService } from '../../../core/anmeldung.service';

interface NavPunkt {
  /** Relativ zum Verwaltungsbereich, ohne führenden Schrägstrich. */
  pfad: string;
  titel: string;
}

/**
 * Menüpunkt, der selbst keine Seite ist, sondern weitere Punkte bündelt.
 *
 * Der Pfad dient nur dazu zu erkennen, ob gerade eine der Unterseiten
 * offen ist — angeklickt wird er nicht, weil es unter /buchfuehrung keine
 * eigene Seite gibt.
 */
interface NavGruppe {
  pfadPraefix: string;
  titel: string;
  punkte: NavPunkt[];
}

@Component({
  selector: 'app-rahmen',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './rahmen.component.html',
  styleUrl: './rahmen.component.scss',
})
export class RahmenComponent {
  protected readonly anmeldungService = inject(AnmeldungService);
  protected readonly daten = inject(VereinsdatenService);
  protected readonly storage = inject(FileStorageService);
  protected readonly thema = inject(ThemaService);

  private readonly router = inject(Router);

  /**
   * Ob die aktuelle Route im Verwaltungsbereich liegt. Steuert, ob sich die
   * Verwaltungs-Unterpunkte in der Sidebar aufklappen und ob die
   * verwaltungsspezifische Statusleiste (Verbindung, Kegeljahr, Verwerfen)
   * im Kopf erscheint — außerhalb der Verwaltung ergeben diese Angaben
   * keinen Sinn.
   */
  protected readonly inVerwaltung = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.includes('/verwaltung')),
    ),
    { initialValue: this.router.url.includes('/verwaltung') },
  );

  /** Ob gerade eine Buchführungsseite offen ist. */
  protected readonly inBuchfuehrung = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.includes('/verwaltung/buchfuehrung')),
    ),
    { initialValue: this.router.url.includes('/verwaltung/buchfuehrung') },
  );

  protected readonly jahrWechselt = signal(false);
  protected readonly verwirft = signal(false);

  protected readonly verwaltungsPunkte: NavPunkt[] = [
    { pfad: 'mitglieder', titel: 'Mitglieder' },
    { pfad: 'kegelabende', titel: 'Kegelabende' },
    { pfad: 'abrechnung', titel: 'Abrechnung' },
  ];

  /**
   * Die Buchführung steht als eigene Gruppe im Menü, weil ihre vier
   * Seiten zusammengehören und die Liste sonst länger ist als der Rest
   * des Menüs zusammen.
   */
  protected readonly buchfuehrung: NavGruppe = {
    pfadPraefix: 'buchfuehrung',
    titel: 'Buchführung',
    punkte: [
      { pfad: 'buchfuehrung/journal', titel: 'Journal' },
      { pfad: 'buchfuehrung/vorfaelle', titel: 'Geschäftsvorfälle' },
      { pfad: 'buchfuehrung/konten', titel: 'Konten' },
      { pfad: 'buchfuehrung/abschluss', titel: 'Jahresabschluss' },
    ],
  };

  /**
   * Aufgeklappt, sobald eine Buchführungsseite offen ist — oder wenn von
   * Hand aufgeklappt wurde.
   *
   * Zwei Quellen statt einer: Beim Aufruf einer Buchführungsseite über
   * einen Verweis oder ein Lesezeichen soll die Gruppe von selbst offen
   * stehen, sonst wüsste man nicht, wo man ist. Zugleich muss sie sich
   * anklicken lassen, wenn man von anderswo kommt.
   */
  private readonly buchfuehrungManuell = signal(false);

  protected readonly buchfuehrungOffen = computed(
    () => this.buchfuehrungManuell() || this.inBuchfuehrung(),
  );

  protected buchfuehrungUmschalten(): void {
    this.buchfuehrungManuell.update((offen) => !offen);
  }

  protected readonly weitereVerwaltungsPunkte: NavPunkt[] = [
    { pfad: 'anleitung', titel: 'Anleitung' },
    { pfad: 'import', titel: 'Altdaten importieren' },
    { pfad: 'sicherungen', titel: 'Sicherungen' },
    { pfad: 'rollen', titel: 'Rollen' },
    { pfad: 'einstellungen', titel: 'Einstellungen' },
  ];

  /**
   * Setzt auf den zuletzt gespeicherten Stand zurück. Die Rückfrage nennt
   * ausdrücklich, dass nichts wiederhergestellt werden kann — der Schritt
   * ist nicht umkehrbar.
   */
  protected async verwerfen(): Promise<void> {
    const bestaetigt = confirm(
      'Alle nicht gespeicherten Änderungen verwerfen und den zuletzt gespeicherten Stand laden?\n\n' +
        'Das lässt sich nicht rückgängig machen.',
    );
    if (!bestaetigt) return;

    this.verwirft.set(true);
    try {
      await this.daten.verwerfen();
    } catch {
      // Fehlertext steht in daten.fehler() und wird auf den Seiten angezeigt.
    } finally {
      this.verwirft.set(false);
    }
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
