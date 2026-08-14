import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../../core/kegelverein/accounting.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { Buchung, KONTENRAHMEN, KontoNummer } from '../../../core/kegelverein/kegelverein.models';
import { datumKurz, euro } from '../../../shared/format.util';

const SEITENGROESSEN = [25, 50, 100, 250] as const;

@Component({
  selector: 'app-buchungen-journal',
  imports: [FormsModule],
  templateUrl: './buchungen-journal.component.html',
  styleUrl: './buchungen-journal.component.scss',
})
export class BuchungenJournalComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumKurz = datumKurz;
  private readonly accounting = inject(AccountingService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  constructor() {
    // Läuft bei jedem vollständigen Datenaustausch (Laden, Verwerfen,
    // Jahreswechsel) und räumt die Bedienzustände auf.
    effect(() => {
      this.daten.datenstand();
      this.bedienzustandZuruecksetzen();
    });
  }

  protected readonly konten = KONTENRAHMEN;
  protected readonly seitengroessen = SEITENGROESSEN;
  protected readonly mitglieder = this.mitgliederService.mitglieder;

  // --- Filter ----------------------------------------------------------

  protected readonly suche = signal('');
  protected readonly filterKonto = signal('');
  protected readonly filterMitgliedId = signal('');
  protected readonly datumVon = signal('');
  protected readonly datumBis = signal('');

  protected readonly istGefiltert = computed(
    () =>
      !!this.suche().trim() ||
      !!this.filterKonto() ||
      !!this.filterMitgliedId() ||
      !!this.datumVon() ||
      !!this.datumBis(),
  );

  /**
   * Jede Filteränderung springt auf Seite 1 zurück — sonst landet man
   * nach dem Filtern auf einer Seite, die es nicht mehr gibt.
   */
  protected filterSetzen(feld: 'suche' | 'konto' | 'mitglied' | 'von' | 'bis', wert: string): void {
    const ziele = {
      suche: this.suche,
      konto: this.filterKonto,
      mitglied: this.filterMitgliedId,
      von: this.datumVon,
      bis: this.datumBis,
    };
    ziele[feld].set(wert);
    this.seite.set(1);
    // Eine Auswahl aus dem vorherigen Filter wäre nach dem Wechsel nicht
    // mehr sichtbar — ein Löschen träfe dann unbemerkt andere Zeilen.
    this.ausgewaehlt.set(new Set());
  }

  protected filterZuruecksetzen(): void {
    this.suche.set('');
    this.filterKonto.set('');
    this.filterMitgliedId.set('');
    this.datumVon.set('');
    this.datumBis.set('');
    this.seite.set(1);
    this.ausgewaehlt.set(new Set());
  }

  protected readonly gefiltert = computed(() => {
    const suchtext = this.suche().trim().toLowerCase();
    const konto = this.filterKonto();
    const mitgliedId = this.filterMitgliedId();
    const von = this.datumVon();
    const bis = this.datumBis();

    return this.accounting
      .buchungen()
      .filter((b) => {
        if (suchtext && !b.buchungstext.toLowerCase().includes(suchtext)) return false;
        if (konto && b.sollKonto !== konto && b.habenKonto !== konto) return false;
        if (mitgliedId && b.mitgliedId !== mitgliedId) return false;
        // ISO-Daten sind als Zeichenketten korrekt vergleichbar.
        if (von && b.datum < von) return false;
        if (bis && b.datum > bis) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.datum.localeCompare(a.datum));
  });

  /** Summe über den gesamten Filter, nicht nur über die sichtbare Seite. */
  protected readonly summe = computed(() => this.gefiltert().reduce((s, b) => s + b.betrag, 0));

  // --- Blättern --------------------------------------------------------

  protected readonly seite = signal(1);
  protected readonly seitenGroesse = signal<number>(SEITENGROESSEN[0]);

  protected readonly seitenAnzahl = computed(() =>
    Math.max(1, Math.ceil(this.gefiltert().length / this.seitenGroesse())),
  );

  /** Begrenzt die Seite, falls der Filter die Trefferzahl verkleinert hat. */
  protected readonly aktuelleSeite = computed(() => Math.min(this.seite(), this.seitenAnzahl()));

  protected readonly sichtbar = computed(() => {
    const start = (this.aktuelleSeite() - 1) * this.seitenGroesse();
    return this.gefiltert().slice(start, start + this.seitenGroesse());
  });

  protected readonly ersteNummer = computed(() =>
    this.gefiltert().length === 0 ? 0 : (this.aktuelleSeite() - 1) * this.seitenGroesse() + 1,
  );

  protected readonly letzteNummer = computed(() =>
    Math.min(this.aktuelleSeite() * this.seitenGroesse(), this.gefiltert().length),
  );

  protected blaettern(richtung: -1 | 1): void {
    this.seite.set(Math.min(this.seitenAnzahl(), Math.max(1, this.aktuelleSeite() + richtung)));
  }

  protected seitenGroesseGesetzt(wert: unknown): void {
    this.seitenGroesse.set(Number(wert) || SEITENGROESSEN[0]);
    this.seite.set(1);
  }

  // --- Mehrfachauswahl -------------------------------------------------

  protected readonly ausgewaehlt = signal<ReadonlySet<string>>(new Set());

  protected readonly anzahlAusgewaehlt = computed(() => this.ausgewaehlt().size);

  protected readonly summeAusgewaehlt = computed(() => {
    const ids = this.ausgewaehlt();
    return this.gefiltert()
      .filter((b) => ids.has(b.id))
      .reduce((s, b) => s + b.betrag, 0);
  });

  /** Alle sichtbaren Zeilen ausgewählt? Grundlage für den Kopf-Haken. */
  protected readonly alleSichtbarGewaehlt = computed(() => {
    const sichtbar = this.sichtbar();
    const ids = this.ausgewaehlt();
    return sichtbar.length > 0 && sichtbar.every((b) => ids.has(b.id));
  });

  protected istAusgewaehlt(id: string): boolean {
    return this.ausgewaehlt().has(id);
  }

  protected auswahlUmschalten(id: string): void {
    this.ausgewaehlt.update((alt) => {
      const neu = new Set(alt);
      neu.has(id) ? neu.delete(id) : neu.add(id);
      return neu;
    });
  }

  /** Bezieht sich nur auf die sichtbare Seite, nicht auf den ganzen Filter. */
  protected alleSichtbarUmschalten(): void {
    const sichtbar = this.sichtbar().map((b) => b.id);
    this.ausgewaehlt.update((alt) => {
      const neu = new Set(alt);
      if (this.alleSichtbarGewaehlt()) sichtbar.forEach((id) => neu.delete(id));
      else sichtbar.forEach((id) => neu.add(id));
      return neu;
    });
  }

  protected auswahlAufheben(): void {
    this.ausgewaehlt.set(new Set());
  }

  protected ausgewaehlteLoeschen(): void {
    const ids = [...this.ausgewaehlt()];
    if (ids.length === 0) return;

    const text =
      `${ids.length} Buchungen über zusammen ${this.euro(this.summeAusgewaehlt())} € löschen?\n\n` +
      `Das lässt sich vor dem Speichern über „Verwerfen“ zurücknehmen.`;
    if (!confirm(text)) return;

    if (ids.includes(this.bearbeiteId() ?? '')) this.bearbeitenAbbrechen();

    this.accounting.loescheBuchungen(ids);
    this.auswahlAufheben();
    this.daten.aenderungVorgemerkt();
  }

  // --- Formular (neu anlegen und bearbeiten) ---------------------------

  // --- Formular --------------------------------------------------------

  /** null = neue Buchung, sonst die id der bearbeiteten Buchung. */
  protected readonly bearbeiteId = signal<string | null>(null);

  protected readonly formDatum = signal(new Date().toISOString().slice(0, 10));
  protected readonly formSoll = signal<KontoNummer>('110');
  protected readonly formHaben = signal<KontoNummer>('330');
  protected readonly formBetrag = signal<number | null>(null);
  protected readonly formText = signal('');
  protected readonly formMitgliedId = signal('');
  protected readonly formularFehler = signal<string | null>(null);
  protected readonly speichert = signal(false);

  protected bearbeitenStarten(b: Buchung): void {
    this.bearbeiteId.set(b.id);
    this.formDatum.set(b.datum);
    this.formSoll.set(b.sollKonto);
    this.formHaben.set(b.habenKonto);
    this.formBetrag.set(b.betrag);
    this.formText.set(b.buchungstext);
    this.formMitgliedId.set(b.mitgliedId ?? '');
    this.formularFehler.set(null);
    // Das Formular steht oben — ohne Sprung bliebe die Änderung unsichtbar.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Übernimmt eine Buchung als Vorlage ins Formular, ohne sie zu ersetzen.
   * Nützlich für Reihen gleichartiger Buchungen, etwa mehrere Bahnmieten.
   */
  protected kopieren(b: Buchung): void {
    this.bearbeiteId.set(null);
    this.formDatum.set(b.datum);
    this.formSoll.set(b.sollKonto);
    this.formHaben.set(b.habenKonto);
    this.formBetrag.set(b.betrag);
    this.formText.set(b.buchungstext);
    this.formMitgliedId.set(b.mitgliedId ?? '');
    this.formularFehler.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected bearbeitenAbbrechen(): void {
    this.bearbeiteId.set(null);
    this.formularLeeren();
  }

  protected uebernehmen(): void {
    const betrag = this.formBetrag();
    const text = this.formText().trim();

    if (!betrag || betrag <= 0) {
      this.formularFehler.set('Betrag muss größer als 0 sein.');
      return;
    }
    if (this.formSoll() === this.formHaben()) {
      this.formularFehler.set('Soll- und Habenkonto müssen verschieden sein.');
      return;
    }
    if (!text) {
      this.formularFehler.set('Buchungstext fehlt.');
      return;
    }

    const daten = {
      datum: this.formDatum(),
      sollKonto: this.formSoll(),
      habenKonto: this.formHaben(),
      betrag,
      buchungstext: text,
      mitgliedId: this.formMitgliedId() || undefined,
    };

    const id = this.bearbeiteId();
    if (id) {
      this.accounting.aktualisiereBuchung({ id, ...daten });
      this.bearbeiteId.set(null);
    } else {
      this.accounting.bucheManuell(daten);
    }

    this.daten.aenderungVorgemerkt();
    this.formularLeeren();
  }

  private formularLeeren(): void {
    this.formBetrag.set(null);
    this.formText.set('');
    this.formMitgliedId.set('');
    this.formularFehler.set(null);
  }

  protected loeschen(b: Buchung): void {
    if (!confirm(`Buchung „${b.buchungstext}“ über ${this.euro(b.betrag)} € löschen?`)) return;
    if (this.bearbeiteId() === b.id) this.bearbeitenAbbrechen();

    this.accounting.loescheBuchung(b.id);
    this.ausgewaehlt.update((alt) => {
      const neu = new Set(alt);
      neu.delete(b.id);
      return neu;
    });
    this.daten.aenderungVorgemerkt();
  }

  // --- Anzeige ---------------------------------------------------------

  protected kontoName(nummer: string): string {
    return KONTENRAHMEN.find((k) => k.nummer === nummer)?.name ?? nummer;
  }

  protected mitgliedName(id: string | undefined): string {
    if (!id) return '';
    return this.mitglieder().find((m) => m.id === id)?.name ?? 'unbekannt';
  }

  /** true, wenn die Buchung eine Kennung trägt, zu der es kein Mitglied gibt. */
  protected verwaisteZuordnung(b: Buchung): boolean {
    return !!b.mitgliedId && !this.mitglieder().some((m) => m.id === b.mitgliedId);
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

  private bedienzustandZuruecksetzen(): void {
    // Nach einem Neuladen kann die bearbeitete Buchung verschwunden sein;
    // ein "Änderung übernehmen" liefe dann ins Leere.
    this.bearbeiteId.set(null);
    this.formularLeeren();
    this.seite.set(1);
    this.ausgewaehlt.set(new Set());
    this.ausgewaehlt.set(new Set());
  }
}
