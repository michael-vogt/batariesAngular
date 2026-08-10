import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KegelabendService } from '../../core/kegelverein/kegelabend.service';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { Kegelabend } from '../../core/kegelverein/kegelverein.models';
import { aktuellerStatus } from '../../core/kegelverein/mitglied.util';
import { datumMitTag, euro } from '../../shared/format.util';

@Component({
  selector: 'app-kegelabend-liste',
  templateUrl: './kegelabend-liste.component.html',
  styleUrl: './kegelabend-liste.component.scss',
  imports: [FormsModule, RouterLink],
})
export class KegelabendListeComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumMitTag = datumMitTag;
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

  protected anlegen(): void {
    const abend: Kegelabend = {
      id: crypto.randomUUID(),
      datum: this.neuDatum(),
      ort: this.neuOrt().trim() || undefined,
      // Nur aktive Mitglieder vorbelegen. Passive und Gastkegler werden
      // im Detail gezielt hinzugenommen, wenn sie tatsächlich mitkegeln.
      teilnehmer: this.mitgliederService
        .mitglieder()
        .filter((m) => aktuellerStatus(m) === 'aktiv')
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
    if (abend.strafenUebernommenAm) {
      // Sonst blieben die zugehörigen Strafenbuchungen ohne Bezugspunkt
      // zurück und ließen sich nicht mehr gezielt zurücknehmen.
      alert(
        'Dieser Abend ist abgerechnet. Zuerst in der Detailansicht die Abrechnung ' +
          'zurücknehmen, danach lässt er sich löschen.',
      );
      return;
    }

    if (!confirm(`Kegelabend vom ${this.datumMitTag(abend.datum)} löschen?`)) return;
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
