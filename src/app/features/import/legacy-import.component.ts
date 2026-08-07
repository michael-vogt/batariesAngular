import { Component, computed, inject, signal } from '@angular/core';
import { FileStorageService } from '../../core/kegelverein/persistenz/file-storage.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
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
  templateUrl: './legacy-import.component.html'
})
export class LegacyImportComponent {
  protected readonly storage = inject(FileStorageService);
  private readonly daten = inject(VereinsdatenService);

  protected readonly phase = signal<Phase>('leer');
  protected readonly ergebnis = signal<ImportErgebnis | null>(null);
  protected readonly abweichungen = signal<string[]>([]);
  protected readonly fehlertext = signal<string | null>(null);
  protected readonly gespeicherteJahre = signal(0);

  protected readonly buchungenOhneMitglied = computed(
    () =>
      this.ergebnis()?.kegeljahre.reduce(
        (summe, kj) => summe + kj.buchungen.filter(b => !b.mitgliedId).length,
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
        e instanceof Error ? `Datei konnte nicht gelesen werden: ${e.message}` : 'Unbekannter Fehler',
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
      // Stammdaten zuerst: die Kegeljahre verweisen per mitgliedId darauf,
      // die referentielle Prüfung beim Speichern würde sonst fehlschlagen.
      await this.storage.mitgliederSpeichern(erg.mitglieder);
      const ids = new Set(erg.mitglieder.map(m => m.id));

      for (const kj of erg.kegeljahre) {
        await this.storage.kegeljahrSpeichern(kj, ids);
      }
      await this.storage.aktuellesKegeljahrSetzen(erg.aktuellesKegeljahrId);

      // Frisch importierte Daten direkt in den Store laden.
      await this.daten.initialisieren();

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
