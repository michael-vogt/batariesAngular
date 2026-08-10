import { Component } from '@angular/core';

/**
 * Die Bedienungsanleitung als Seite in der Anwendung.
 *
 * Der Inhalt entspricht der Datei BEDIENUNG.md und wurde daraus erzeugt.
 * Die Gestaltung ist der PDF-Fassung nachempfunden; über den Druckdialog
 * des Browsers lässt sich die Seite in derselben Form ausgeben (siehe
 * @media print im Stylesheet).
 *
 * Bewusst statisches Markup statt eines Markdown-Renderers: das spart eine
 * Abhängigkeit, und der Text ändert sich selten.
 */
@Component({
  selector: 'app-anleitung',
  templateUrl: './anleitung.component.html',
  styleUrl: './anleitung.component.scss',
})
export class AnleitungComponent {
  protected drucken(): void {
    window.print();
  }
}
