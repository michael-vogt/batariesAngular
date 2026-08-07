import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { Mitglied, MitgliedStatus } from '../../core/kegelverein/kegelverein.models';
import { findeNamensdublette } from '../../core/kegelverein/namen.util';
import {
  STATUS_BEZEICHNUNG,
  aktuellerStatus,
  mitStatusaenderung,
  neuesMitglied,
  sortierterVerlauf,
} from '../../core/kegelverein/mitglied.util';

const HEUTE = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-mitglieder-liste',
  imports: [FormsModule],
  template: `
    <div class="seite">
      <header class="seiten-kopf">
        <h1>Mitglieder</h1>
        <div class="kopf-aktionen">
          @if (daten.ungespeichert()) {
            <span class="hinweis">Nicht gespeicherte Änderungen</span>
          }
          <button
            type="button"
            class="primaer"
            [disabled]="!daten.ungespeichert() || speichert()"
            (click)="speichern()"
          >
            {{ speichert() ? 'Speichert…' : 'Änderungen speichern' }}
          </button>
        </div>
      </header>

      @if (daten.fehler(); as text) {
        <p class="fehler">{{ text }}</p>
      }

      @if (mitglieder().length === 0) {
        <div class="karte">
          <p>Noch keine Mitglieder erfasst. Unten das erste Mitglied anlegen.</p>
        </div>
      } @else {
        @for (gruppe of gruppen(); track gruppe.titel) {
          <div class="karte gruppe">
            <h2>
              {{ gruppe.titel }}
              <span class="anzahl">{{ gruppe.zeilen.length }}</span>
            </h2>

            @if (gruppe.zeilen.length === 0) {
              <p class="hinweis">Keine Einträge.</p>
            } @else {
              <table class="daten">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Amt</th>
                    <th class="zahl">Beiträge</th>
                    <th class="zahl">Strafen</th>
                    <th class="zahl">Umlagen</th>
                    <th class="zahl">Offen</th>
                    <th class="zahl">Restguthaben</th>
                    <th><span class="visuell-versteckt">Aktionen</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (zeile of gruppe.zeilen; track zeile.mitglied.id) {
                    <tr>
                      <td>
                        @if (bearbeiteId() === zeile.mitglied.id) {
                          <input
                            type="text"
                            [ngModel]="entwurfName()"
                            (ngModelChange)="entwurfName.set($event)"
                            (keyup.enter)="bearbeitungSpeichern()"
                            (keyup.escape)="bearbeitungAbbrechen()"
                          />
                        } @else {
                          {{ zeile.mitglied.name }}
                        }
                      </td>
                      <td>
                        <select
                          [ngModel]="zeile.status"
                          (ngModelChange)="statusGeaendert(zeile.mitglied, $event)"
                        >
                          <option value="aktiv">aktiv</option>
                          <option value="passiv">passiv</option>
                          <option value="gastkegler">Gastkegler</option>
                          <option value="ausgetreten">ausgetreten</option>
                        </select>
                      </td>
                      <td class="leise">{{ zeile.mitglied.rolle || '—' }}</td>
                      <td class="zahl">{{ euro(zeile.finanzen.offeneBeitraege) }}</td>
                      <td class="zahl">{{ euro(zeile.finanzen.offeneStrafen) }}</td>
                      <td class="zahl">{{ euro(zeile.finanzen.offeneUmlagen) }}</td>
                      <td
                        class="zahl"
                        [class.betrag-offen]="zeile.finanzen.offeneForderungenGesamt > 0"
                      >
                        {{ euro(zeile.finanzen.offeneForderungenGesamt) }}
                      </td>
                      <td class="zahl" [class.betrag-guthaben]="zeile.finanzen.restguthaben > 0">
                        {{ euro(zeile.finanzen.restguthaben) }}
                      </td>
                      <td>
                        @if (bearbeiteId() === zeile.mitglied.id) {
                          <button type="button" class="leise-aktion" (click)="bearbeitungSpeichern()">
                            Fertig
                          </button>
                        } @else {
                          <button
                            type="button"
                            class="leise-aktion"
                            (click)="bearbeitungStarten(zeile.mitglied)"
                          >
                            Umbenennen
                          </button>
                          <button
                            type="button"
                            class="leise-aktion"
                            (click)="verlaufUmschalten(zeile.mitglied.id)"
                          >
                            {{ verlaufOffen() === zeile.mitglied.id ? 'Verlauf zu' : 'Verlauf' }}
                          </button>
                        }
                      </td>
                    </tr>

                    @if (verlaufOffen() === zeile.mitglied.id) {
                      <tr class="verlauf">
                        <td colspan="9">
                          <h3>Statusverlauf</h3>
                          <ol>
                            @for (e of verlaufVon(zeile.mitglied); track e.ab + e.status) {
                              <li>
                                <span class="datum">{{ datumKurz(e.ab) }}</span>
                                <span>{{ statusText(e.status) }}</span>
                                @if (e.notiz) { <span class="leise">— {{ e.notiz }}</span> }
                              </li>
                            }
                          </ol>
                          <div class="formular-zeile">
                            <label>
                              Status ab
                              <input
                                type="date"
                                [ngModel]="wechselDatum()"
                                (ngModelChange)="wechselDatum.set($event)"
                              />
                            </label>
                            <label>
                              neuer Status
                              <select
                                [ngModel]="wechselStatus()"
                                (ngModelChange)="wechselStatus.set($event)"
                              >
                                <option value="aktiv">aktiv</option>
                                <option value="passiv">passiv</option>
                                <option value="gastkegler">Gastkegler</option>
                                <option value="ausgetreten">ausgetreten</option>
                              </select>
                            </label>
                            <label>
                              Notiz (optional)
                              <input
                                type="text"
                                [ngModel]="wechselNotiz()"
                                (ngModelChange)="wechselNotiz.set($event)"
                              />
                            </label>
                            <button type="button" (click)="wechselEintragen(zeile.mitglied)">
                              Eintragen
                            </button>
                            <button
                              type="button"
                              class="leise-aktion"
                              (click)="loeschen(zeile.mitglied)"
                            >
                              Mitglied entfernen
                            </button>
                          </div>
                          <p class="hinweis">
                            Rückwirkende Einträge sind möglich — Monatsbeiträge werden nach dem
                            Status zum jeweiligen Buchungsdatum berechnet.
                          </p>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6"><strong>Summe {{ gruppe.titel }}</strong></td>
                    <td class="zahl"><strong>{{ euro(gruppe.summeOffen) }}</strong></td>
                    <td class="zahl"><strong>{{ euro(gruppe.summeGuthaben) }}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            }
          </div>
        }

        @if (bearbeitenFehler(); as text) {
          <p class="fehler">{{ text }}</p>
        }
      }

      <div class="karte neu">
        <h2>Mitglied aufnehmen</h2>
        <div class="formular-zeile">
          <label>
            Name
            <input
              type="text"
              [ngModel]="neuName()"
              (ngModelChange)="neuName.set($event)"
              (keyup.enter)="anlegen()"
            />
          </label>
          <label>
            Status
            <select [ngModel]="neuStatus()" (ngModelChange)="neuStatus.set($event)">
              <option value="aktiv">aktiv</option>
              <option value="passiv">passiv</option>
              <option value="gastkegler">Gastkegler</option>
            </select>
          </label>
          <label>
            Amt (optional)
            <input type="text" [ngModel]="neuRolle()" (ngModelChange)="neuRolle.set($event)" />
          </label>
          <button type="button" [disabled]="!neuName().trim()" (click)="anlegen()">
            Aufnehmen
          </button>
        </div>
        @if (anlegeFehler(); as text) {
          <p class="fehler">{{ text }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .kopf-aktionen {
      display: flex;
      align-items: center;
      gap: var(--abstand-3);
    }
    .gruppe { margin-top: var(--abstand-6); }
    .gruppe h2 {
      display: flex; align-items: center; gap: var(--abstand-2);
      margin: 0 0 var(--abstand-3); font-size: 1.0625rem; font-weight: 600;
    }
    .gruppe .anzahl {
      padding: 0 var(--abstand-2);
      border-radius: 999px;
      background: var(--farbe-akzent-hell);
      color: var(--farbe-akzent);
      font-family: var(--schrift-zahl);
      font-size: 0.75rem;
    }
    tr.verlauf > td { background: var(--farbe-flaeche); }
    tr.verlauf h3 { margin: 0 0 var(--abstand-2); font-size: 0.875rem; font-weight: 600; }
    tr.verlauf ol {
      margin: 0 0 var(--abstand-3); padding-left: var(--abstand-4);
      font-size: 0.875rem;
    }
    tr.verlauf .datum {
      display: inline-block; min-width: 6.5rem;
      font-family: var(--schrift-zahl); color: var(--farbe-text-leise);
    }
    tr.verlauf .hinweis { margin: var(--abstand-2) 0 0; font-size: 0.8125rem; }
    .neu { margin-top: var(--abstand-6); }
    .neu h2 { margin: 0 0 var(--abstand-3); font-size: 1.0625rem; font-weight: 600; }
    .formular-zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--abstand-3);
    }
    .formular-zeile label {
      display: flex;
      flex-direction: column;
      gap: var(--abstand-1);
      font-size: 0.8125rem;
      color: var(--farbe-text-leise);
    }
    .visuell-versteckt {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class MitgliederListeComponent {
  private readonly mitgliederService = inject(MitgliederService);
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly mitglieder = this.mitgliederService.mitglieder;

  /** Stammdaten und berechnete Finanzen paarweise für die Tabelle. */
  protected readonly zeilen = computed(() => {
    const finanzen = this.accounting.finanzenAlleMitglieder();
    return this.mitglieder().map(mitglied => ({
      mitglied,
      status: aktuellerStatus(mitglied),
      finanzen:
        finanzen.find(f => f.mitgliedId === mitglied.id) ??
        {
          mitgliedId: mitglied.id,
          offeneBeitraege: 0,
          offeneStrafen: 0,
          offeneUmlagen: 0,
          offeneForderungenGesamt: 0,
          restguthaben: 0,
        },
    }));
  });

  /**
   * Vereinsmitglieder und Gastkegler getrennt: Gäste sammeln sich über die
   * Jahre an und würden die eigentliche Mitgliederliste sonst zuwachsen.
   * Jede Gruppe bekommt ihre eigene Summe — die Vereinssumme soll nicht
   * durch Gästeforderungen verfälscht werden.
   */
  protected readonly gruppen = computed(() => {
    const alle = this.zeilen();
    const bauen = (titel: string, zeilen: typeof alle) => ({
      titel,
      zeilen,
      summeOffen: zeilen.reduce((s, z) => s + z.finanzen.offeneForderungenGesamt, 0),
      summeGuthaben: zeilen.reduce((s, z) => s + z.finanzen.restguthaben, 0),
    });

    return [
      bauen(
        'Vereinsmitglieder',
        alle.filter(z => z.status === 'aktiv' || z.status === 'passiv' || z.status === null),
      ),
      bauen('Gastkegler', alle.filter(z => z.status === 'gastkegler')),
      bauen('Ausgetreten', alle.filter(z => z.status === 'ausgetreten')),
    ].filter(g => g.zeilen.length > 0 || g.titel === 'Vereinsmitglieder');
  });

  protected readonly bearbeiteId = signal<string | null>(null);
  protected readonly entwurfName = signal('');
  protected readonly neuName = signal('');
  protected readonly neuStatus = signal<MitgliedStatus>('aktiv');
  protected readonly neuRolle = signal('');
  protected readonly anlegeFehler = signal<string | null>(null);
  protected readonly bearbeitenFehler = signal<string | null>(null);
  protected readonly verlaufOffen = signal<string | null>(null);
  protected readonly wechselDatum = signal(HEUTE());
  protected readonly wechselStatus = signal<MitgliedStatus>('passiv');
  protected readonly wechselNotiz = signal('');
  protected readonly speichert = signal(false);

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected anlegen(): void {
    const name = this.neuName().trim();
    if (!name) return;

    const dublette = findeNamensdublette(this.mitglieder(), name);
    if (dublette) {
      const status = aktuellerStatus(dublette);
      this.anlegeFehler.set(
        `„${dublette.name}“ ist bereits erfasst${status ? ` (${this.statusText(status)})` : ''}.`,
      );
      return;
    }

    this.mitgliederService.hinzufuegen(
      neuesMitglied(name, this.neuStatus(), HEUTE(), this.neuRolle().trim() || undefined),
    );

    this.neuName.set('');
    this.neuRolle.set('');
    this.anlegeFehler.set(null);
    this.daten.aenderungVorgemerkt();
  }

  protected bearbeitungStarten(m: Mitglied): void {
    this.bearbeiteId.set(m.id);
    this.entwurfName.set(m.name);
  }

  protected bearbeitungSpeichern(): void {
    const id = this.bearbeiteId();
    const name = this.entwurfName().trim();
    const mitglied = this.mitglieder().find(m => m.id === id);

    if (!mitglied || !name || name === mitglied.name) {
      this.bearbeitungAbbrechen();
      return;
    }

    // Auch beim Umbenennen darf kein zweiter Eintrag mit gleichem Namen
    // entstehen; das Mitglied selbst ist von der Prüfung ausgenommen.
    const dublette = findeNamensdublette(this.mitglieder(), name, mitglied.id);
    if (dublette) {
      this.bearbeitenFehler.set(`„${dublette.name}“ ist bereits erfasst.`);
      return;
    }

    this.mitgliederService.aktualisieren({ ...mitglied, name });
    this.daten.aenderungVorgemerkt();
    this.bearbeitungAbbrechen();
  }

  protected bearbeitungAbbrechen(): void {
    this.bearbeiteId.set(null);
    this.entwurfName.set('');
    this.bearbeitenFehler.set(null);
  }

  /** Schnellwechsel aus der Tabelle: gilt ab heute. Für rückwirkende
   *  Änderungen den Verlauf aufklappen. */
  protected statusGeaendert(m: Mitglied, status: MitgliedStatus): void {
    if (aktuellerStatus(m) === status) return;
    this.mitgliederService.aktualisieren(mitStatusaenderung(m, status, HEUTE()));
    this.daten.aenderungVorgemerkt();
  }

  protected verlaufUmschalten(id: string): void {
    this.verlaufOffen.update(offen => (offen === id ? null : id));
    this.wechselDatum.set(HEUTE());
    this.wechselNotiz.set('');
  }

  protected verlaufVon(m: Mitglied) {
    return sortierterVerlauf(m);
  }

  protected statusText(status: MitgliedStatus): string {
    return STATUS_BEZEICHNUNG[status];
  }

  protected datumKurz(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE');
  }

  protected wechselEintragen(m: Mitglied): void {
    const ab = this.wechselDatum();
    if (!ab) return;

    this.mitgliederService.aktualisieren(
      mitStatusaenderung(m, this.wechselStatus(), ab, this.wechselNotiz().trim() || undefined),
    );
    this.daten.aenderungVorgemerkt();
    this.wechselNotiz.set('');
  }

  protected loeschen(m: Mitglied): void {
    const finanzen = this.accounting.finanzenAlleMitglieder().find(f => f.mitgliedId === m.id);
    const hatBewegungen =
      (finanzen?.offeneForderungenGesamt ?? 0) !== 0 || (finanzen?.restguthaben ?? 0) !== 0;

    const text = hatBewegungen
      ? `${m.name} hat offene Beträge. Buchungen und Spielabende verlieren die Zuordnung. `
        + `Für Austritte besser den Status auf „ausgetreten“ setzen. Trotzdem endgültig entfernen?`
      : `${m.name} endgültig entfernen? Für Austritte genügt der Status „ausgetreten“.`;

    if (!confirm(text)) return;

    this.mitgliederService.loeschen(m.id);
    this.daten.aenderungVorgemerkt();
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
    } catch {
      // Fehlertext steht bereits in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }
}
