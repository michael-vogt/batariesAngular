import { Injectable, effect, inject, signal, Service } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PhpApiAdapter } from './kegelverein/persistenz/php-api-adapter';

//export type Berechtigung = 'verwaltung' | 'terminPlanung' | 'termineAbmelden';

export const BERECHTIGUNGSLISTE = [
  {
    schluessel: 'verwaltung',
    titel: 'Verwaltung',
    beschreibung: 'Mitglieder, Buchführung, Abrechnung, Jahresabschluss, Sicherungen'
  },
  {
    schluessel: 'terminplanung',
    titel: 'Terminplanung',
    beschreibung: 'Termine anlegen und löschen'
  },
  {
    schluessel: 'termineAbmelden',
    titel: 'Von Terminen abmelden',
    beschreibung: 'sich von Terminen abmelden'
  }
] as const;

export type Berechtigung = (typeof BERECHTIGUNGSLISTE)[number]['schluessel'];

/**
 * Was eine Rolle darf.
 *
 * Der Server liefert stets alle bekannten Berechtigungen — was in der
 * Rollendatei fehlt, kommt als false zurück. Die Gegenseite muss deshalb
 * nicht zwischen "nicht erteilt" und "nicht eingetragen" unterscheiden.
 */
/*export interface Berechtigungen {
  verwaltung: boolean;
  terminplanung: boolean;
  termineAbmelden: boolean;
}*/
export type Berechtigungen = Record<Berechtigung, boolean>;


/** Keine Berechtigung — Ausgangswert und Rückfallebene. */
/*export const KEINE_BERECHTIGUNGEN: Berechtigungen = {
  verwaltung: false,
  terminplanung: false,
  termineAbmelden: false,
};*/
export const KEINE_BERECHTIGUNGEN: Berechtigungen = Object.fromEntries(
  BERECHTIGUNGSLISTE.map(b => [b.schluessel, false]),
) as Berechtigungen;

/**
 * Bringt eine Antwort des Servers in die feste Form.
 *
 * Fehlende Angaben gelten als nicht erteilt: Im Zweifel lieber zu wenig
 * erlauben als zu viel.
 */
export function normalisiereBerechtigungen(roh: Partial<Berechtigungen> | undefined): Berechtigungen {
  return Object.fromEntries(
    BERECHTIGUNGSLISTE.map(b => [b.schluessel, roh?.[b.schluessel] === true]),
  ) as Berechtigungen;
}


/** Ergebnis einer Prüfung von Rolle und Zugangsdaten. */
export type PruefErgebnis =
  | { gueltig: true; name: string; berechtigungen: Berechtigungen }
  | { gueltig: false; grund: 'abgelehnt' | 'nicht_erreichbar' | 'unvollstaendig'; meldung: string };

/** Eine Rolle samt ihren Rechten — nur für Berechtigte einsehbar. */
export interface RolleMitRechten {
  name: string;
  berechtigungen: Berechtigungen;
}

interface AuthAntwort {
  gueltig: boolean;
  name?: string;
  berechtigungen?: Partial<Berechtigungen>;
}

/**
 * Prüft Rollen gegen die serverseitige Rollendatei.
 *
 * Die Prüfung geschieht ausschließlich auf dem Server (auth.php). Eine
 * Prüfung im Browser wäre wirkungslos: Die Rollendatei müsste dafür
 * ausgeliefert werden, und jeder könnte die hinterlegten Zugangsdaten
 * einsehen. Deshalb liegt sie außerhalb des Datenverzeichnisses und ist
 * über die Datei-API nicht abrufbar.
 *
 * Dieser Dienst beantwortet allein die Frage, ob Name und Zugangsdaten
 * zusammenpassen. Er merkt sich nichts, eröffnet keine Sitzung und
 * schränkt nichts ein — das gehört in eine Anmeldung, die darauf
 * aufsetzt.
 */
@Service()
export class RollenService {
  private readonly http = inject(HttpClient);
  private readonly adapter = inject(PhpApiAdapter);

  /*readonly berechtigungsNamen: (keyof Berechtigungen)[] = [
    'termineAbmelden',
    'terminplanung',
    'verwaltung',
  ];*/

  private readonly _rollennamen = signal<string[]>([]);
  private readonly _namenLaden = signal(false);

  /**
   * Die vorhandenen Rollennamen, für eine Auswahlliste beim Anmelden.
   *
   * Wird geladen, sobald eine Serververbindung besteht, und geleert, wenn
   * sie getrennt wird. Komponenten lesen das Signal einfach — ohne selbst
   * den richtigen Zeitpunkt abpassen zu müssen.
   */
  readonly rollennamen = this._rollennamen.asReadonly();

  /** true, solange die Namen abgerufen werden. */
  readonly namenLaden = this._namenLaden.asReadonly();

  constructor() {
    effect(() => {
      // hatVerbindung() liest intern ein Signal und wird dadurch
      // beobachtet: Der Effekt läuft erneut, sobald sich der
      // Verbindungszustand ändert.
      if (this.adapter.hatVerbindung()) {
        void this.namenLadenVomServer();
      } else {
        this._rollennamen.set([]);
      }
    });
  }

  /**
   * Lädt die Rollennamen erneut.
   *
   * Normalerweise nicht nötig — der Effekt im Konstruktor erledigt das
   * beim Verbinden. Sinnvoll nur, wenn sich die Rollendatei auf dem
   * Server geändert hat, während die Anwendung offen war.
   */
  async namenAktualisieren(): Promise<void> {
    await this.namenLadenVomServer();
  }

  /**
   * Holt die Namen vom Server.
   *
   * Fehler werden geschluckt und führen zu einer leeren Liste: Eine
   * Auswahlliste ist ein Komfort, für den nichts scheitern muss. Wer sich
   * anmelden will, kann den Namen weiterhin eintippen.
   */
  private async namenLadenVomServer(): Promise<void> {
    if (!this.adapter.hatVerbindung()) {
      this._rollennamen.set([]);
      return;
    }

    this._namenLaden.set(true);
    try {
      const antwort = await firstValueFrom(
        this.http.get<{ rollen?: string[] }>(
          `${this.adapter.endpunktUrl('auth.php')}?aktion=rollen`,
          { headers: this.adapter.apiKeyKopfzeile() },
        ),
      );
      this._rollennamen.set(antwort?.rollen ?? []);
    } catch {
      this._rollennamen.set([]);
    } finally {
      this._namenLaden.set(false);
    }
  }

  /**
   * Liest alle Rollen samt Berechtigungen.
   *
   * Verlangt gültige Zugangsdaten einer Rolle, die selbst
   * Verwaltungsrechte hat — wer die Rechte anderer einsehen will, muss
   * sie auch vergeben dürfen. Hashes liefert der Server grundsätzlich
   * nicht mit.
   */
  async rollenMitRechten(name: string, credential: string): Promise<RolleMitRechten[] | null> {
    if (!this.adapter.hatVerbindung()) return null;

    try {
      const antwort = await firstValueFrom(
        this.http.post<{ rollen?: RolleMitRechten[] }>(
          `${this.adapter.endpunktUrl('auth.php')}?aktion=rollen`,
          { name: name.trim(), credential },
          { headers: this.adapter.apiKeyKopfzeile() },
        ),
      );
      return antwort?.rollen ?? [];
    } catch {
      // 401 (Zugangsdaten falsch) und 403 (nicht berechtigt) laufen hier
      // zusammen: Beides bedeutet für den Aufrufer, dass es die Auskunft
      // nicht gibt.
      return null;
    }
  }

  /**
   * Legt eine neue Rolle an.
   *
   * Verlangt die Zugangsdaten einer Rolle mit Verwaltungsrecht — es gibt
   * keine Sitzung, jeder schreibende Aufruf weist sich erneut aus.
   *
   * Das Passwort wird im Klartext übertragen und erst auf dem Server
   * gehasht. Ein im Browser erzeugter Hash wäre wertlos: Wer ihn
   * abfängt, könnte sich damit anmelden, und der Server hätte keine
   * Möglichkeit zu prüfen, wie er zustande kam. Voraussetzung ist
   * deshalb HTTPS.
   */
  async rolleAnlegen(
    ausweis: { name: string; credential: string },
    neueRolle: { name: string; passwort: string; berechtigungen: Berechtigungen },
  ): Promise<{ angelegt: true } | { angelegt: false; meldung: string }> {
    if (!this.adapter.hatVerbindung()) {
      return { angelegt: false, meldung: 'Keine Serververbindung.' };
    }

    try {
      await firstValueFrom(
        this.http.post<{ angelegt: boolean }>(
          `${this.adapter.endpunktUrl('auth.php')}?aktion=rolle-anlegen`,
          {
            name: ausweis.name.trim(),
            credential: ausweis.credential,
            neueRolle: {
              name: neueRolle.name.trim(),
              passwort: neueRolle.passwort,
              berechtigungen: neueRolle.berechtigungen,
            },
          },
          { headers: this.adapter.apiKeyKopfzeile() },
        ),
      );

      // Die Auswahlliste beim Anmelden soll die neue Rolle sofort kennen.
      await this.namenAktualisieren();
      return { angelegt: true };
    } catch (e) {
      return { angelegt: false, meldung: this.fehlertext(e) };
    }
  }

  /**
   * Übersetzt eine Fehlerantwort in einen Satz für die Oberfläche.
   *
   * Die Meldungen des Servers sind bereits verständlich formuliert und
   * werden bevorzugt; nur wenn keine da ist, greift eine allgemeine.
   */
  private fehlertext(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const vomServer = (e.error as { error?: string } | null)?.error;
      if (vomServer) return vomServer;

      if (e.status === 401) return 'Die eigenen Zugangsdaten stimmen nicht.';
      if (e.status === 403) return 'Diese Rolle darf keine Rollen anlegen.';
    }
    return 'Die Rolle konnte nicht angelegt werden.';
  }

  /**
   * Prüft Name und Zugangsdaten.
   *
   * Wirft nicht, sondern liefert das Ergebnis als Wert: Eine abgelehnte
   * Anmeldung ist ein erwarteter Ausgang und keine Ausnahme. Unterschieden
   * wird aber, ob abgelehnt oder gar nicht erst geprüft wurde — sonst
   * sähe ein Serverausfall wie ein falsches Passwort aus.
   */
  async pruefe(name: string, credential: string): Promise<PruefErgebnis> {
    if (!name.trim() || !credential) {
      return {
        gueltig: false,
        grund: 'unvollstaendig',
        meldung: 'Bitte Name und Zugangsdaten angeben.',
      };
    }

    if (!this.adapter.hatVerbindung()) {
      return {
        gueltig: false,
        grund: 'nicht_erreichbar',
        meldung: 'Keine Serververbindung — bitte zuerst unter Einstellungen verbinden.',
      };
    }

    try {
      const antwort = await firstValueFrom(
        this.http.post<AuthAntwort>(
          this.adapter.endpunktUrl('auth.php'),
          { name: name.trim(), credential },
          { headers: this.adapter.apiKeyKopfzeile() },
        ),
      );

      if (antwort?.gueltig && antwort.name) {
        return {
          gueltig: true,
          name: antwort.name,
          berechtigungen: normalisiereBerechtigungen(antwort.berechtigungen),
        };
      }

      return {
        gueltig: false,
        grund: 'abgelehnt',
        meldung: 'Name oder Zugangsdaten stimmen nicht.',
      };
    } catch (e) {
      // 401 ist die reguläre Ablehnung durch auth.php, alles andere ein
      // technisches Problem — die Unterscheidung ist wichtig, damit
      // niemand vergeblich sein Passwort neu eintippt.
      if (e instanceof HttpErrorResponse && e.status === 401) {
        return {
          gueltig: false,
          grund: 'abgelehnt',
          meldung: 'Name oder Zugangsdaten stimmen nicht.',
        };
      }

      return {
        gueltig: false,
        grund: 'nicht_erreichbar',
        meldung: 'Die Prüfung war nicht möglich. Bitte später erneut versuchen.',
      };
    }
  }
}
