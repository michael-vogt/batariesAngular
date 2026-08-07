import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KegelabendService } from '../../core/kegelverein/kegelabend.service';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { Kegelabend } from '../../core/kegelverein/kegelverein.models';

@Component({
  selector: 'app-kegelabend-liste',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="seite">
      <header class="seiten-kopf">
        <h1>Kegelabende</h1>
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

      <div class="karte">
        <h2>Neuer Kegelabend</h2>
        <div class="formular-zeile">
          <label>
            Datum
            <input type="date" [ngModel]="neuDatum()" (ngModelChange)="neuDatum.set($event)" />
          </label>
          <label>
            Ort (optional)
            <input type="text" [ngModel]="neuOrt()" (ngModelChange)="neuOrt.set($event)" />
          </label>
          <button type="button" [disabled]="!neuDatum()" (click)="anlegen()">Anlegen</button>
        </div>
        <p class="hinweis">Alle aktiven Mitglieder werden automatisch als anwesend eingetragen.</p>
      </div>

      @if (abende().length === 0) {
        <div class="karte leer">
          <p>Noch kein Kegelabend erfasst.</p>
        </div>
      } @else {
        <div class="karte liste">
          <table class="daten">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Ort</th>
                <th class="zahl">Anwesend</th>
                <th class="zahl">Runden</th>
                <th class="zahl">Strafen gesamt</th>
                <th><span class="visuell-versteckt">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              @for (zeile of zeilen(); track zeile.abend.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/kegelabende', zeile.abend.id]">
                      {{ datumLang(zeile.abend.datum) }}
                    </a>
                  </td>
                  <td class="leise">{{ zeile.abend.ort || '—' }}</td>
                  <td class="zahl">{{ zeile.anwesend }} / {{ zeile.abend.teilnehmer.length }}</td>
                  <td class="zahl">{{ zeile.runden }}</td>
                  <td class="zahl">{{ euro(zeile.strafen) }}</td>
                  <td>
                    <button type="button" class="leise-aktion" (click)="loeschen(zeile.abend)">
                      Löschen
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .kopf-aktionen {
      display: flex;
      align-items: center;
      gap: var(--abstand-3);
    }
    .karte h2 {
      margin: 0 0 var(--abstand-3);
      font-size: 1.0625rem;
      font-weight: 600;
    }
    .liste,
    .leer {
      margin-top: var(--abstand-6);
    }
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
    .formular-zeile + .hinweis {
      margin: var(--abstand-3) 0 0;
    }
    a {
      color: var(--farbe-akzent);
    }
    .visuell-versteckt {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class KegelabendListeComponent {
  private readonly kegelabendService = inject(KegelabendService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly neuDatum = signal(new Date().toISOString().slice(0, 10));
  protected readonly neuOrt = signal('');
  protected readonly speichert = signal(false);

  /** Neueste zuerst — der zuletzt gespielte Abend wird am häufigsten gebraucht. */
  protected readonly abende = computed(() =>
    [...this.kegelabendService.kegelabende()].sort((a, b) => b.datum.localeCompare(a.datum)),
  );

  protected readonly zeilen = computed(() =>
    this.abende().map((abend) => {
      const ergebnisse = this.kegelabendService.ergebnisse(abend);
      return {
        abend,
        anwesend: abend.teilnehmer.filter((t) => t.anwesend).length,
        runden: Object.values(abend.runden).reduce((s, r) => s + (r?.length ?? 0), 0),
        strafen: ergebnisse.reduce((s, z) => s + z.strafeGesamt, 0),
      };
    }),
  );

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected datumLang(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected anlegen(): void {
    const abend: Kegelabend = {
      id: crypto.randomUUID(),
      datum: this.neuDatum(),
      ort: this.neuOrt().trim() || undefined,
      // Nur aktive Mitglieder vorbelegen. Passive und Gastkegler werden
      // im Detail gezielt hinzugenommen, wenn sie tatsächlich mitkegeln.
      teilnehmer: this.mitgliederService
        .mitglieder()
        .filter((m) => m.status === 'aktiv')
        .map((m) => ({
          id: m.id,
          name: m.name,
          anwesend: true,
          verspaetungStunden: 0,
          pumpen: 0,
          neuner: 0,
          eingeholt: 0,
          schnaps: 0,
        })),
      runden: {},
    };

    this.kegelabendService.speichern(abend);
    this.daten.aenderungVorgemerkt();
    this.neuOrt.set('');
  }

  protected loeschen(abend: Kegelabend): void {
    if (!confirm(`Kegelabend vom ${this.datumLang(abend.datum)} löschen?`)) return;
    this.kegelabendService.loeschen(abend.id);
    this.daten.aenderungVorgemerkt();
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }
}
