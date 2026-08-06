import { Component, computed, inject, signal } from '@angular/core';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';
import {
  ImportErgebnis,
  importiereLegacyExport,
  pruefeSummaryAbweichungen,
} from '../../core/kegelverein/persistenz/legacy-import';

type Phase = 'leer' | 'geprueft' | 'speichert' | 'fertig' | 'fehler';

/**
 * Einmalige Übernahme der Altdaten (daten.json der Vorgängeranwendung).
 *
 * Bewusst zweistufig: erst einlesen und prüfen, dann — nach Sichtung der
 * Meldungen — explizit speichern. So landen keine Daten unbesehen auf dem
 * Server, und die Warnungen lassen sich vorher durchgehen.
 */
@Component({
  selector: 'app-legacy-import',
  template: `
    <section class="import">
      <h2>Altdaten importieren</h2>

      @if (storage.status() !== 'verbunden') {
        <p class="fehler">Keine Serververbindung — bitte zuerst unter Einstellungen verbinden.</p>
      } @else {
        <p class="hinweis">
          Datei <code>daten.json</code> der alten Anwendung auswählen. Die Daten werden zunächst nur
          geprüft und angezeigt, gespeichert wird erst auf Knopfdruck.
        </p>

        <input type="file" accept="application/json,.json" (change)="dateiGewaehlt($event)" />

        @if (fehlertext(); as text) {
          <p class="fehler">{{ text }}</p>
        }

        @if (ergebnis(); as erg) {
          <h3>Vorschau</h3>
          <ul class="jahre">
            @for (kj of erg.kegeljahre; track kj.id) {
              <li>
                <strong>{{ kj.bezeichnung }}</strong>
                ({{ kj.startDatum }} bis {{ kj.endDatum }}) — {{ kj.mitglieder.length }} Mitglieder,
                {{ kj.buchungen.length }} Buchungen, {{ kj.kegelabende.length }} Kegelabende
              </li>
            }
          </ul>

          <p>
            Buchungen ohne Mitgliedszuordnung: {{ buchungenOhneMitglied() }}
            <span class="hinweis"> (normal für allgemeine Vereinsbuchungen wie Bahnmiete) </span>
          </p>

          @if (erg.warnungen.length) {
            <h4>Warnungen ({{ erg.warnungen.length }})</h4>
            <p class="hinweis">
              Kein Blocker — die Daten werden trotzdem importiert. Meist verweisen sie auf
              ausgetretene Mitglieder, die noch in alten Buchungen auftauchen.
            </p>
            <ul class="warnungen">
              @for (w of erg.warnungen; track w) {
                <li>{{ w }}</li>
              }
            </ul>
          }

          @if (abweichungen().length) {
            <h4>Abweichende Spielabend-Auswertungen ({{ abweichungen().length }})</h4>
            <p class="hinweis">
              Die in den Altdaten gespeicherten Strafen passen hier nicht zu den zugrundeliegenden
              Runden. Übernommen werden die neu berechneten Werte.
            </p>
            <ul class="warnungen">
              @for (a of abweichungen(); track a) {
                <li>{{ a }}</li>
              }
            </ul>
          } @else {
            <p class="ok">Spielabend-Auswertungen stimmen mit den Altdaten überein.</p>
          }

          <button type="button" [disabled]="phase() === 'speichert'" (click)="speichern()">
            {{ phase() === 'speichert' ? 'Speichere…' : 'Auf Server speichern' }}
          </button>
        }

        @if (phase() === 'fertig') {
          <p class="ok">
            Import abgeschlossen — {{ gespeicherteJahre() }} Kegeljahr(e) gespeichert.
          </p>
        }
      }
    </section>
  `,
})
export class LegacyImportComponent {
  protected readonly storage = inject(FileStorageService);

  protected readonly phase = signal<Phase>('leer');
  protected readonly ergebnis = signal<ImportErgebnis | null>(null);
  protected readonly abweichungen = signal<string[]>([]);
  protected readonly fehlertext = signal<string | null>(null);
  protected readonly gespeicherteJahre = signal(0);

  protected readonly buchungenOhneMitglied = computed(
    () =>
      this.ergebnis()?.kegeljahre.reduce(
        (summe, kj) => summe + kj.buchungen.filter((b) => !b.mitgliedId).length,
        0,
      ) ?? 0,
  );

  protected async dateiGewaehlt(event: Event): Promise<void> {
    const datei = (event.target as HTMLInputElement).files?.[0];
    if (!datei) return;

    this.zuruecksetzen();

    try {
      const json = JSON.parse(await datei.text());
      const erg = importiereLegacyExport(json);

      this.ergebnis.set(erg);
      this.abweichungen.set(pruefeSummaryAbweichungen(json, erg.kegeljahre));
      this.phase.set('geprueft');
    } catch (e) {
      this.fehlertext.set(
        e instanceof Error
          ? `Datei konnte nicht gelesen werden: ${e.message}`
          : 'Unbekannter Fehler',
      );
      this.phase.set('fehler');
    }
  }

  protected async speichern(): Promise<void> {
    const erg = this.ergebnis();
    if (!erg) return;

    this.phase.set('speichert');
    this.fehlertext.set(null);

    try {
      for (const kj of erg.kegeljahre) {
        await this.storage.kegeljahrSpeichern(kj);
      }
      await this.storage.aktuellesKegeljahrSetzen(erg.aktuellesKegeljahrId);

      this.gespeicherteJahre.set(erg.kegeljahre.length);
      this.phase.set('fertig');
    } catch (e) {
      // Validierung oder Serverfehler — Teilstände können bereits gespeichert sein,
      // ein erneuter Durchlauf überschreibt sie jedoch idempotent.
      this.fehlertext.set(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      this.phase.set('fehler');
    }
  }

  private zuruecksetzen(): void {
    this.ergebnis.set(null);
    this.abweichungen.set([]);
    this.fehlertext.set(null);
    this.gespeicherteJahre.set(0);
    this.phase.set('leer');
  }
}
