import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { AbschlussVorschau } from '../../../core/kegelverein/jahresabschluss.logic';
import { erzeugeJahresbericht } from '../../../core/kegelverein/bilanz.logic';
import { datumKurz, euro } from '../../../shared/format.util';

/**
 * Vorschlag für den Beginn: der 1. Oktober des laufenden Kegeljahres.
 * Vor Oktober liegt der Beginn im Vorjahr.
 */
function vorschlagJahresbeginn(): string {
  const heute = new Date();
  const jahr = heute.getMonth() >= 9 ? heute.getFullYear() : heute.getFullYear() - 1;
  return `${jahr}-10-01`;
}

/** Ein Tag vor dem gleichen Datum im Folgejahr. */
function einJahrSpaeter(startDatum: string): string {
  if (!startDatum) return '';
  const d = new Date(`${startDatum}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-jahresabschluss',
  imports: [FormsModule],
  templateUrl: './jahresabschluss.component.html',
  styleUrl: './jahresabschluss.component.scss',
})
export class JahresabschlussComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumKurz = datumKurz;
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  constructor() {
    // Läuft bei jedem vollständigen Datenaustausch (Laden, Verwerfen,
    // Jahreswechsel) und räumt die Bedienzustände auf.
    effect(() => {
      this.daten.datenstand();
      this.bedienzustandZuruecksetzen();
    });
  }

  protected readonly vorschau = signal<AbschlussVorschau | null>(null);
  protected readonly pruefFehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly abgeschlossen = signal(false);

  protected readonly aktuellesJahr = this.daten.aktuellesJahr;

  // --- Erstinbetriebnahme ------------------------------------------------

  /** Es gibt noch gar kein Kegeljahr — dann fehlt der Einstieg. */
  protected readonly nochKeinJahr = computed(
    () => this.daten.status() === 'bereit' && this.daten.verfuegbareJahre().length === 0,
  );

  protected readonly neuStart = signal(vorschlagJahresbeginn());
  protected readonly neuEnde = linkedSignal(() => einJahrSpaeter(this.neuStart()));
  protected readonly legtAn = signal(false);

  protected async erstesJahrAnlegen(): Promise<void> {
    const start = this.neuStart();
    const ende = this.neuEnde();
    if (!start || !ende) return;

    const bezeichnung = `Kegeljahr ${start.slice(0, 4)}/${ende.slice(0, 4)}`;
    if (!confirm(`${bezeichnung} anlegen (${this.datumKurz(start)} bis ${this.datumKurz(ende)})?`))
      return;

    this.legtAn.set(true);
    try {
      await this.daten.erstesKegeljahrAnlegen(start, ende);
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.legtAn.set(false);
    }
  }

  /**
   * Bilanz und GuV des laufenden Jahres — der Anhang für die
   * Generalversammlung. Wird laufend aus den Buchungen berechnet und ist
   * unabhängig davon, ob das Jahr schon abgeschlossen wurde.
   */
  protected readonly bericht = computed(() => {
    const jahr = this.daten.aktuellesJahr();
    return jahr ? erzeugeJahresbericht(jahr) : null;
  });

  protected readonly berichtSichtbar = signal(false);

  protected berichtUmschalten(): void {
    this.berichtSichtbar.update((offen) => !offen);
  }

  // --- Bilanz und GuV als PDF -------------------------------------------

  protected readonly pdfLaeuft = signal(false);
  protected readonly pdfFehler = signal<string | null>(null);

  /** Für die Anzeige des Ergebnisses ohne Vorzeichen. */
  protected abs(n: number): number {
    return Math.abs(n);
  }

  /**
   * Erzeugt den Anhang zur Generalversammlung als PDF: Eröffnungsbilanz,
   * Schlussbilanz und GuV, nach dem Muster der bisherigen Anhänge.
   *
   * jsPDF wird erst beim Klick geladen — die Bibliothek ist die größte
   * Abhängigkeit der Anwendung und wird nur hier und in der Abrechnung
   * gebraucht.
   */
  protected async berichtAlsPdf(): Promise<void> {
    const b = this.bericht();
    if (!b) return;

    this.pdfFehler.set(null);
    this.pdfLaeuft.set(true);

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      const geld = (n: number) => `${this.euro(n)} €`;
      const jahr = b.bezeichnung.replace('Kegeljahr ', '');

      doc.setFontSize(13);
      doc.text(`Bilanz des Kegeljahres ${jahr}`, 14, 16);

      const bilanzTabelle = (titel: string, seite: typeof b.eroeffnungsbilanz, startY: number) => {
        doc.setFontSize(10);
        doc.text(titel, 14, startY);

        autoTable(doc, {
          startY: startY + 3,
          head: [['Aktiva', '', 'Passiva', '']],
          // Unterposten werden durch führende Leerzeichen eingerückt —
          // autoTable kennt keine Einzugsangabe je Zelle.
          body: [
            ['Anlagevermögen', '', 'Vereinsvermögen', geld(seite.vereinsvermoegen)],
            ['    ./.', geld(0), '', ''],
            ['Umlaufvermögen', '', 'Verbindlichkeiten', ''],
            [
              '    Forderungen',
              geld(seite.forderungen),
              '    Restguthaben',
              geld(seite.restguthaben),
            ],
            ['    Kasse', geld(seite.kasse), '    Schulden ggü. Dritten', geld(seite.schulden)],
          ],
          foot: [
            ['Summe Aktiva', geld(seite.summeAktiva), 'Summe Passiva', geld(seite.summePassiva)],
          ],
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
          headStyles: { fillColor: [64, 64, 64], textColor: [255, 255, 255], fontStyle: 'bold' },
          footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          bodyStyles: { textColor: [0, 0, 0], fillColor: [255, 255, 255] },
          columnStyles: {
            1: { halign: 'right', cellWidth: 32 },
            3: { halign: 'right', cellWidth: 32 },
          },
          // Zeile 0 und 2 tragen die Oberposten.
          didParseCell: (data: {
            row: { index: number };
            column: { index: number };
            cell: { styles: { fontStyle: string } };
          }) => {
            if ([0, 2].includes(data.row.index) && data.column.index % 2 === 0) {
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });

        return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      };

      let y = bilanzTabelle(
        `Eröffnungsbilanz zum ${this.datumKurz(b.startDatum)}`,
        b.eroeffnungsbilanz,
        24,
      );
      y = bilanzTabelle(`Schlussbilanz zum ${this.datumKurz(b.endDatum)}`, b.schlussbilanz, y);

      doc.setFontSize(13);
      doc.text(`Gewinn- und Verlustrechnung des Kegeljahres ${jahr}`, 14, y + 4);

      const g = b.guv;
      autoTable(doc, {
        startY: y + 8,
        body: [
          ['Erträge:', 'Beiträge', geld(g.beitraege)],
          ['', 'Strafen', geld(g.strafen)],
          ['', 'Umlagen', geld(g.umlagen)],
          ['', 'Sonstige Erträge', geld(g.sonstigeErtraege)],
          ['', 'Erträge gesamt:', geld(g.ertraegeGesamt)],
          ['Aufwendungen:', 'Kegelbahn', geld(g.kegelbahn)],
          ['', 'Vereinsrunden', geld(g.vereinsrunden)],
          ['', 'Generalversammlung', geld(g.generalversammlung)],
          ['', 'Sonstige Aufwendungen', geld(g.sonstigeAufwendungen)],
          ['', 'Aufwendungen gesamt:', geld(g.aufwendungenGesamt)],
          [
            g.ergebnis >= 0 ? 'Jahresüberschuss:' : 'Jahresfehlbetrag:',
            '',
            geld(Math.abs(g.ergebnis)),
          ],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 38 },
          2: { halign: 'right', cellWidth: 32 },
        },
        // Die beiden Summenzeilen und das Ergebnis hervorheben.
        didParseCell: (data: {
          row: { index: number };
          cell: { styles: { fontStyle: string } };
        }) => {
          if ([4, 9, 10].includes(data.row.index)) data.cell.styles.fontStyle = 'bold';
        },
      });

      doc.save(`bilanz_${b.endDatum.replace(/-/g, '')}.pdf`);
    } catch (e) {
      this.pdfFehler.set(
        e instanceof Error ? `PDF konnte nicht erzeugt werden: ${e.message}` : 'Unbekannter Fehler',
      );
    } finally {
      this.pdfLaeuft.set(false);
    }
  }

  /** Bestände, die übertragen werden — zur Kontrolle vor dem Abschluss. */
  protected readonly bestaende = computed(() => {
    const salden = this.accounting.salden();
    return {
      kasse: salden['110'].soll - salden['110'].haben,
      forderungen: salden['100'].soll - salden['100'].haben,
      restguthaben: salden['210'].haben - salden['210'].soll,
      vereinsvermoegen: salden['200'].haben - salden['200'].soll,
    };
  });

  protected readonly summe = computed(
    () => this.vorschau()?.eroeffnungsbuchungen.reduce((s, b) => s + b.betrag, 0) ?? 0,
  );

  protected vorschauErstellen(): void {
    this.pruefFehler.set(null);
    this.abgeschlossen.set(false);
    try {
      this.vorschau.set(this.daten.abschlussVorbereiten());
    } catch (e) {
      this.vorschau.set(null);
      this.pruefFehler.set(e instanceof Error ? e.message : 'Vorschau nicht möglich');
    }
  }

  protected verwerfen(): void {
    this.vorschau.set(null);
    this.pruefFehler.set(null);
  }

  protected async ausfuehren(): Promise<void> {
    const v = this.vorschau();
    if (!v) return;

    const text =
      `${v.neuesKegeljahr.bezeichnung} anlegen und ${v.eroeffnungsbuchungen.length} ` +
      `Eröffnungsbuchungen übernehmen?\n\n` +
      `Das abgeschlossene Jahr bleibt erhalten und kann weiterhin eingesehen werden.`;
    if (!confirm(text)) return;

    this.laeuft.set(true);
    try {
      await this.daten.abschlussAusfuehren(v);
      this.vorschau.set(null);
      this.abgeschlossen.set(true);
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.laeuft.set(false);
    }
  }

  private bedienzustandZuruecksetzen(): void {
    // Eine erstellte Vorschau bezieht sich auf die vorherigen Buchungen
    // und wäre nach einem Neuladen nicht mehr belastbar.
    this.vorschau.set(null);
    this.pruefFehler.set(null);
    this.abgeschlossen.set(false);
  }
}
