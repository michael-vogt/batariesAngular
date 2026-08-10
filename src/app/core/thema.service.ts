import { Injectable, effect, signal } from '@angular/core';

export type Thema = 'hell' | 'bash';

const SPEICHER_SCHLUESSEL = 'kegelverein-thema';

export const THEMEN: readonly { wert: Thema; name: string; beschreibung: string }[] = [
  { wert: 'hell', name: 'Hell', beschreibung: 'Heller Hintergrund, Systemschrift' },
  { wert: 'bash', name: 'Terminal', beschreibung: 'Dunkel, Konsolenschrift' },
];

/**
 * Verwaltet das gewählte Erscheinungsbild.
 *
 * Die Umsetzung liegt vollständig in CSS: der Dienst setzt lediglich
 * `data-thema` am <html>-Element, die Farbwerte kommen aus tokens.css.
 * Dadurch braucht keine Komponente das Thema zu kennen.
 */
@Injectable({ providedIn: 'root' })
export class ThemaService {
  private readonly _thema = signal<Thema>(this.geladenesThema());
  readonly thema = this._thema.asReadonly();

  constructor() {
    effect(() => {
      const thema = this._thema();
      document.documentElement.dataset['thema'] = thema;
      try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, thema);
      } catch {
        // Privater Modus o.ä.: Speichern schlägt fehl, das Thema gilt
        // trotzdem für die laufende Sitzung.
      }
    });
  }

  setzen(thema: Thema): void {
    this._thema.set(thema);
  }

  umschalten(): void {
    this._thema.update((aktuell) => (aktuell === 'hell' ? 'bash' : 'hell'));
  }

  private geladenesThema(): Thema {
    try {
      const gespeichert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (gespeichert === 'hell' || gespeichert === 'bash') return gespeichert;
    } catch {
      // Kein Zugriff auf localStorage — mit dem Standard weitermachen.
    }
    return 'hell';
  }
}
