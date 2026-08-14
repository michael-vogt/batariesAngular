import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../../core/kegelverein/accounting.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { erzeugeAbrechnung } from '../../../core/kegelverein/abrechnung.logic';
import { datumKurz, euro } from '../../../shared/format.util';

@Component({
  selector: 'app-abrechnung',
  imports: [FormsModule],
  templateUrl: './abrechnung.component.html',
  styleUrl: './abrechnung.component.scss',
})
export class AbrechnungComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumKurz = datumKurz;
  private readonly accounting = inject(AccountingService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly stichtag = signal(new Date().toISOString().slice(0, 10));
  protected readonly ausgetreteneAusblenden = signal(true);
  protected readonly erzeugt = signal(false);
  protected readonly pdfFehler = signal<string | null>(null);

  protected readonly abrechnung = computed(() =>
    erzeugeAbrechnung({
      mitglieder: this.mitgliederService.mitglieder(),
      buchungen: this.accounting.buchungen(),
      stichtag: this.stichtag(),
      ausgetreteneAusblenden: this.ausgetreteneAusblenden(),
    }),
  );

  /**
   * Differenz zwischen dem Forderungskonto und der Summe aller
   * mitgliedsbezogenen Forderungen. Ist sie ungleich null, gibt es
   * Buchungen ohne Mitgliedszuordnung — die tauchen in der Abrechnung
   * nicht auf und würden sonst unbemerkt fehlen.
   */
  protected readonly nichtZugeordnet = computed(() => {
    const salden = this.accounting.salden();
    const kontoForderungen = salden['100'].soll - salden['100'].haben;
    const s = this.abrechnung().summen;
    const brutto = s.beitraege + s.strafen + s.umlagen;
    return Math.round((kontoForderungen - brutto) * 100) / 100;
  });

  /**
   * jsPDF wird erst beim Klick geladen (dynamischer Import). Die Bibliothek
   * ist mit Abstand die größte Abhängigkeit der Anwendung und wird nur hier
   * gebraucht — im Startbundle hätte sie nichts verloren.
   */
  protected async pdfErzeugen(): Promise<void> {
    this.pdfFehler.set(null);

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const a = this.abrechnung();
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(14);
      doc.text('Abrechnung', 14, 16);
      doc.setFontSize(10);
      doc.text(
        `${this.daten.aktuellesJahr()?.bezeichnung ?? ''} · Stand ${this.datumKurz(a.stichtag)}`,
        14,
        22,
      );

      autoTable(doc, {
        startY: 28,
        head: [
          [
            `Stand: ${this.datumKurz(a.stichtag)}`,
            'Beiträge',
            'Strafen',
            'Umlagen',
            'Ausgleich',
            'Summe',
            'bezahlt',
            'übriges Restguthaben',
          ],
        ],
        body: a.zeilen.map((z) => [
          z.name,
          `${this.euro(z.beitraege)} €`,
          `${this.euro(z.strafen)} €`,
          `${this.euro(z.umlagen)} €`,
          // Der Ausgleich mindert die Forderung — im Ausdruck als Minusbetrag.
          `${z.ausgleich > 0 ? '-' : ''}${this.euro(z.ausgleich)} €`,
          `${this.euro(z.summe)} €`,
          // Bewusst leer: Spalte zum handschriftlichen Abhaken am Kegelabend.
          '',
          `${this.euro(z.verbleibendesRestguthaben)} €`,
        ]),
        foot: [
          [
            'Summe',
            `${this.euro(a.summen.beitraege)} €`,
            `${this.euro(a.summen.strafen)} €`,
            `${this.euro(a.summen.umlagen)} €`,
            `${a.summen.ausgleich > 0 ? '-' : ''}${this.euro(a.summen.ausgleich)} €`,
            `${this.euro(a.summen.summe)} €`,
            '',
            `${this.euro(a.summen.verbleibendesRestguthaben)} €`,
          ],
        ],
        // Nur die beiden Felder, die hier gebraucht werden — so bleibt der
        // Rückruf unabhängig von der genauen Typversion der Bibliothek.
        didParseCell: (data: {
          column: { index: number };
          cell: { styles: { halign: string } };
        }) => {
          if (data.column.index > 0) data.cell.styles.halign = 'right';
        },
        columnStyles: {
          5: { fontStyle: 'bold' },
          6: { cellWidth: 30 },
        },
        headStyles: { fillColor: [64, 64, 64], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { textColor: [0, 0, 0], fillColor: [255, 255, 255] },
        styles: { cellPadding: 4, fontSize: 10, lineColor: [0, 0, 0], lineWidth: 0.2 },
      });

      const dateiname = `abrechnung_${a.stichtag.replace(/-/g, '')}.pdf`;
      doc.save(dateiname);
      this.erzeugt.set(true);
    } catch (e) {
      this.pdfFehler.set(
        e instanceof Error ? `PDF konnte nicht erzeugt werden: ${e.message}` : 'Unbekannter Fehler',
      );
    }
  }
}
