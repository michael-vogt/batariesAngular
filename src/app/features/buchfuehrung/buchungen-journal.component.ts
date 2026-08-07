import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { Buchung, KONTENRAHMEN, KontoNummer } from '../../core/kegelverein/kegelverein.models';

@Component({
  selector: 'app-buchungen-journal',
  imports: [FormsModule],
  templateUrl: './buchungen-journal.component.html',
  styleUrl: './buchungen-journal.component.scss',
})
export class BuchungenJournalComponent {
  private readonly accounting = inject(AccountingService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly konten = KONTENRAHMEN;
  protected readonly mitglieder = this.mitgliederService.mitglieder;

  // --- Filter ---
  protected readonly suche = signal('');
  protected readonly filterKonto = signal<string>('');
  protected readonly filterMitgliedId = signal<string>('');

  // --- Formular für freie Buchungen ---
  protected readonly neuDatum = signal(new Date().toISOString().slice(0, 10));
  protected readonly neuSoll = signal<KontoNummer>('110');
  protected readonly neuHaben = signal<KontoNummer>('330');
  protected readonly neuBetrag = signal<number | null>(null);
  protected readonly neuText = signal('');
  protected readonly neuMitgliedId = signal('');
  protected readonly formularFehler = signal<string | null>(null);
  protected readonly speichert = signal(false);

  /** Neueste zuerst; bei gleichem Datum bleibt die Erfassungsreihenfolge. */
  protected readonly gefiltert = computed(() => {
    const suchtext = this.suche().trim().toLowerCase();
    const konto = this.filterKonto();
    const mitgliedId = this.filterMitgliedId();

    return this.accounting
      .buchungen()
      .filter((b) => {
        if (suchtext && !b.buchungstext.toLowerCase().includes(suchtext)) return false;
        if (konto && b.sollKonto !== konto && b.habenKonto !== konto) return false;
        if (mitgliedId && b.mitgliedId !== mitgliedId) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.datum.localeCompare(a.datum));
  });

  protected readonly summe = computed(() => this.gefiltert().reduce((s, b) => s + b.betrag, 0));

  protected readonly istGefiltert = computed(
    () => !!this.suche().trim() || !!this.filterKonto() || !!this.filterMitgliedId(),
  );

  protected kontoName(nummer: string): string {
    return KONTENRAHMEN.find((k) => k.nummer === nummer)?.name ?? nummer;
  }

  protected mitgliedName(id: string | undefined): string {
    if (!id) return '';
    return this.mitglieder().find((m) => m.id === id)?.name ?? 'unbekannt';
  }

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected datumKurz(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE');
  }

  protected filterZuruecksetzen(): void {
    this.suche.set('');
    this.filterKonto.set('');
    this.filterMitgliedId.set('');
  }

  protected buchen(): void {
    const betrag = this.neuBetrag();
    const text = this.neuText().trim();

    if (!betrag || betrag <= 0) {
      this.formularFehler.set('Betrag muss größer als 0 sein.');
      return;
    }
    if (this.neuSoll() === this.neuHaben()) {
      this.formularFehler.set('Soll- und Habenkonto müssen verschieden sein.');
      return;
    }
    if (!text) {
      this.formularFehler.set('Buchungstext fehlt.');
      return;
    }

    this.accounting.bucheManuell({
      datum: this.neuDatum(),
      sollKonto: this.neuSoll(),
      habenKonto: this.neuHaben(),
      betrag,
      buchungstext: text,
      mitgliedId: this.neuMitgliedId() || undefined,
    });

    this.daten.aenderungVorgemerkt();
    this.neuBetrag.set(null);
    this.neuText.set('');
    this.neuMitgliedId.set('');
    this.formularFehler.set(null);
  }

  protected loeschen(b: Buchung): void {
    if (!confirm(`Buchung „${b.buchungstext}“ über ${this.euro(b.betrag)} € löschen?`)) return;
    this.accounting.loescheBuchung(b.id);
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
