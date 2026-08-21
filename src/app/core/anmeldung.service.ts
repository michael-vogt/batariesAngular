import { computed, inject, signal, Service } from '@angular/core';
import {
  Berechtigung,
  Berechtigungen,
  KEINE_BERECHTIGUNGEN,
  RollenService,
  normalisiereBerechtigungen,
} from './rollen.service';

const SPEICHER_SCHLUESSEL = 'kegelverein-anmeldung';

interface AngemeldeteRolle {
  name: string;
  berechtigungen: Berechtigungen;
}

/**
 * Hält fest, wer gerade angemeldet ist.
 *
 * Der Zustand liegt im sessionStorage und übersteht damit ein Neuladen
 * der Seite, verschwindet aber beim Schließen des Tabs. Das ist bewusst
 * so gewählt: Ein gemeinsam genutzter Rechner soll nicht dauerhaft
 * angemeldet bleiben.
 *
 * Was hier NICHT passiert: Das Passwort wird nicht gespeichert. Es dient
 * einmalig der Prüfung und wird danach verworfen — was im Browser liegt,
 * kann ein eingeschleustes Skript auslesen.
 *
 * Ebenso wichtig: Das ist eine Bequemlichkeit, keine Schutzgrenze. Wer
 * den gespeicherten Eintrag von Hand ändert, gibt sich beliebige Rechte.
 * Verlässlich prüfen kann nur der Server, und das tut er bei jedem
 * schreibenden Aufruf an der Rollenverwaltung ohnehin.
 */
@Service()
export class AnmeldungService {
  private readonly rollen = inject(RollenService);

  private readonly _rolle = signal<AngemeldeteRolle | null>(this.ausSpeicher());
  private readonly _laeuft = signal(false);
  private readonly _fehler = signal<string | null>(null);

  readonly rolle = this._rolle.asReadonly();
  readonly laeuft = this._laeuft.asReadonly();
  readonly fehler = this._fehler.asReadonly();

  readonly angemeldet = computed(() => this._rolle() !== null);
  readonly name = computed(() => this._rolle()?.name ?? '');
  readonly berechtigungen = computed(() => this._rolle()?.berechtigungen ?? KEINE_BERECHTIGUNGEN);

  /** Kurzform für die Templates: `@if (anmeldung.darf('verwaltung')) { … }` */
  darf(recht: Berechtigung): boolean {
    return this.berechtigungen()[recht];
  }

  async anmelden(name: string, credential: string): Promise<boolean> {
    this._laeuft.set(true);
    this._fehler.set(null);

    try {
      const ergebnis = await this.rollen.pruefe(name, credential);

      if (!ergebnis.gueltig) {
        this._fehler.set(ergebnis.meldung);
        return false;
      }

      const rolle: AngemeldeteRolle = {
        name: ergebnis.name,
        berechtigungen: ergebnis.berechtigungen,
      };
      this._rolle.set(rolle);
      this.inSpeicher(rolle);
      return true;
    } finally {
      this._laeuft.set(false);
    }
  }

  abmelden(): void {
    this._rolle.set(null);
    this._fehler.set(null);
    try {
      sessionStorage.removeItem(SPEICHER_SCHLUESSEL);
    } catch {
      // Privater Modus o.ä. — der Zustand im Speicher ist ohnehin geleert.
    }
  }

  /**
   * Liest den gespeicherten Zustand beim Start.
   *
   * Der Inhalt wird geprüft statt blind übernommen: Er stammt aus dem
   * Browser und könnte von Hand geändert oder von einer älteren Fassung
   * der Anwendung geschrieben worden sein. Bei Zweifeln gilt: nicht
   * angemeldet.
   */
  private ausSpeicher(): AngemeldeteRolle | null {
    try {
      const roh = sessionStorage.getItem(SPEICHER_SCHLUESSEL);
      if (!roh) return null;

      const gelesen = JSON.parse(roh) as Partial<AngemeldeteRolle>;
      if (typeof gelesen?.name !== 'string' || !gelesen.name) return null;

      return {
        name: gelesen.name,
        // Normalisieren, damit eine seither hinzugekommene Berechtigung
        // nicht undefined ist, sondern als nicht erteilt gilt.
        berechtigungen: normalisiereBerechtigungen(gelesen.berechtigungen),
      };
    } catch {
      return null;
    }
  }

  private inSpeicher(rolle: AngemeldeteRolle): void {
    try {
      sessionStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(rolle));
    } catch {
      // Kein Speicherzugriff: Die Anmeldung gilt dann nur bis zum
      // nächsten Neuladen. Kein Grund, den Vorgang scheitern zu lassen.
    }
  }
}
