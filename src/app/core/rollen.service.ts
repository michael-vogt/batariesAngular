import { Service, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PhpApiAdapter } from './kegelverein/persistenz/php-api-adapter';

export type Berechtigung = 'verwaltung' | 'terminPlanung' | 'termineAbmelden';

/**
 * Was eine Rolle darf.
 *
 * Der Server liefert stets alle bekannten Berechtigungen — was in der
 * Rollendatei fehlt, kommt als false zurück. Die Gegenseite muss deshalb
 * nicht zwischen "nicht erteilt" und "nicht eingetragen" unterscheiden.
 */
export interface Berechtigungen {
  /** Zugang zu Mitgliedern, Buchführung, Abrechnung und Jahresabschluss. */
  verwaltung: boolean;
  /** Zugang zur Terminplanung */
  terminplanung: boolean;
  /** Zugang zur Terminplanung zwecks Abmeldung. */
  termineAbmelden: boolean;
}

/** Keine Berechtigung — Ausgangswert und Rückfallebene. */
export const KEINE_BERECHTIGUNGEN: Berechtigungen = {
  verwaltung: false,
  terminplanung: false,
  termineAbmelden: false,
};

/** Ergebnis einer Prüfung von Rolle und Zugangsdaten. */
export type PruefErgebnis =
  | { gueltig: true; name: string; berechtigungen: Berechtigungen }
  | { gueltig: false; grund: 'abgelehnt' | 'nicht_erreichbar' | 'unvollstaendig'; meldung: string };

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
          // Fehlende Angaben sicherheitshalber als nicht erteilt werten:
          // Im Zweifel lieber zu wenig erlauben als zu viel.
          berechtigungen: {
            verwaltung: antwort.berechtigungen?.verwaltung === true,
            terminplanung: antwort.berechtigungen?.terminplanung === true,
            termineAbmelden: antwort.berechtigungen?.termineAbmelden === true,
          },
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
