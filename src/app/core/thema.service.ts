import { Service, computed, effect, signal } from '@angular/core';

export type Thema = 'hell' | 'bash' | 'kegelbahn';

interface ThemaBeschreibung {
  symbol: string;
  /** Für "Zum {{wechselnZu}} wechseln". */
  wechselnZu: string;
  /** Für "{{einschalten}} einschalten". */
  einschalten: string;
}

const SPEICHER_SCHLUESSEL = 'kegelverein-thema';

const REIHENFOLGE: Thema[] = ['hell', 'bash', 'kegelbahn'];

const BESCHREIBUNGEN: Record<Thema, ThemaBeschreibung> = {
  hell: { symbol: '☀', wechselnZu: 'hellen Thema', einschalten: 'Helles Thema' },
  bash: { symbol: '>_', wechselnZu: 'Terminal-Thema', einschalten: 'Terminal-Thema' },
  kegelbahn: { symbol: '🎳', wechselnZu: 'Kegelbahn-Thema', einschalten: 'Kegelbahn-Thema' },
};

/**
 * Verwaltet das gewählte Erscheinungsbild.
 *
 * Die Umsetzung liegt vollständig in CSS: der Dienst setzt lediglich
 * `data-thema` am <html>-Element, die Farbwerte kommen aus tokens.css.
 * Dadurch braucht keine Komponente das Thema zu kennen.
 */
@Service()
export class ThemaService {
  private readonly _thema = signal<Thema>(this.geladenesThema());
  readonly thema = this._thema.asReadonly();

  /** Das Thema, zu dem ein Klick auf den Umschalter als Nächstes wechselt. */
  readonly naechstes = computed(() => this.naechstesNach(this._thema()));

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

  /** Wechselt reihum zum jeweils nächsten Thema. */
  umschalten(): void {
    this._thema.update((aktuell) => this.naechstesNach(aktuell));
  }

  beschreibung(thema: Thema): ThemaBeschreibung {
    return BESCHREIBUNGEN[thema];
  }

  private naechstesNach(thema: Thema): Thema {
    const index = REIHENFOLGE.indexOf(thema);
    return REIHENFOLGE[(index + 1) % REIHENFOLGE.length];
  }

  private geladenesThema(): Thema {
    try {
      const gespeichert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (REIHENFOLGE.includes(gespeichert as Thema)) return gespeichert as Thema;
    } catch {
      // Kein Zugriff auf localStorage — mit dem Standard weitermachen.
    }
    return 'hell';
  }
}
