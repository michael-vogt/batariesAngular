import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';

/**
 * Die Bedienungsanleitung als Seite in der Anwendung.
 *
 * Inhalt und Inhaltsverzeichnis werden aus BEDIENUNG.md erzeugt
 * (npm run anleitung) — das Template wird nicht von Hand bearbeitet.
 * Die Gestaltung ist der PDF-Fassung nachempfunden; über den Druckdialog
 * lässt sich die Seite in derselben Form ausgeben.
 */
@Component({
  selector: 'app-anleitung',
  templateUrl: './anleitung.component.html',
  styleUrl: './anleitung.component.scss',
})
export class AnleitungComponent implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Sprungmarke des Abschnitts, der gerade gelesen wird. */
  protected readonly aktiv = signal<string | null>(null);

  private beobachter?: IntersectionObserver;

  ngAfterViewInit(): void {
    const ueberschriften = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>('.dokument h2[id]'),
    );
    if (ueberschriften.length === 0) return;

    /**
     * Der schmale Streifen am oberen Rand sorgt dafür, dass jeweils der
     * Abschnitt gilt, dessen Überschrift zuletzt nach oben durchgelaufen
     * ist — nicht der, der zufällig die größte Fläche einnimmt.
     */
    this.beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const eintrag of eintraege) {
          if (eintrag.isIntersecting) this.aktiv.set(eintrag.target.id);
        }
      },
      { rootMargin: '-80px 0px -75% 0px', threshold: 0 },
    );

    for (const ueberschrift of ueberschriften) this.beobachter.observe(ueberschrift);
  }

  ngOnDestroy(): void {
    this.beobachter?.disconnect();
  }

  /**
   * Springt weich zum Abschnitt. Bewusst nicht dem href überlassen: der
   * Router würde die Adresse um das Fragment ergänzen, und der Sprung
   * erfolgte ohne Übergang.
   */
  protected springe(ereignis: Event, id: string): void {
    ereignis.preventDefault();

    const ziel = this.element.nativeElement.querySelector(`#${CSS.escape(id)}`);
    ziel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.aktiv.set(id);
  }

  protected drucken(): void {
    window.print();
  }
}
