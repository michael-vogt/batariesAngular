import { Injectable, computed, signal } from '@angular/core';
import { Buchung, Kegelabend, Kegeljahr, Mitglied } from './kegelverein.models';

/**
 * Zentraler State-Container: hält alle Kegeljahre und das aktuell
 * ausgewählte. Alle Domänen-Collections (Mitglieder/Buchungen/Kegelabende)
 * sind reine Projektionen des aktuellen Kegeljahrs.
 *
 * Bewusst ohne NgRx: Für die Größe dieser App reichen Signals völlig aus,
 * die Store-API bleibt aber so geschnitten, dass eine spätere Migration
 * zu NgRx (Actions ≈ die public-Methoden, Selectors ≈ die computed-Felder)
 * ohne Umbau der Aufrufer möglich ist.
 */
@Injectable({ providedIn: 'root' })
export class KegeljahrStore {
  private readonly _kegeljahre = signal<Kegeljahr[]>([]);
  private readonly _aktuellesKegeljahrId = signal<string | null>(null);

  /**
   * Vereinsweite Stammdaten, bewusst neben (nicht in) den Kegeljahren:
   * ein Mitglied existiert jahresübergreifend. Buchungen und Kegelabende
   * verweisen per mitgliedId hierauf.
   */
  private readonly _mitglieder = signal<Mitglied[]>([]);
  readonly mitglieder = this._mitglieder.asReadonly();

  readonly kegeljahre = this._kegeljahre.asReadonly();
  readonly aktuellesKegeljahrId = this._aktuellesKegeljahrId.asReadonly();

  /**
   * Zähler, der bei jedem vollständigen Austausch der Daten hochgezählt
   * wird — also beim Laden vom Server, beim Verwerfen und beim Wechsel des
   * Kegeljahres, nicht bei einzelnen Änderungen.
   *
   * Komponenten beobachten ihn per effect() und setzen daraufhin ihre
   * Bedienzustände zurück: eine offene Bearbeitung zeigt sonst auf einen
   * Datensatz, den es nach dem Neuladen möglicherweise nicht mehr gibt.
   */
  private readonly _datenstand = signal(0);
  readonly datenstand = this._datenstand.asReadonly();

  private datenstandErhoehen(): void {
    this._datenstand.update((n) => n + 1);
  }

  readonly aktuellesKegeljahr = computed(
    () => this._kegeljahre().find((kj) => kj.id === this._aktuellesKegeljahrId()) ?? null,
  );

  readonly buchungen = computed(() => this.aktuellesKegeljahr()?.buchungen ?? []);
  readonly kegelabende = computed(() => this.aktuellesKegeljahr()?.kegelabende ?? []);

  // ---------------------------------------------------------------
  // Kegeljahr
  // ---------------------------------------------------------------

  setKegeljahre(kegeljahre: Kegeljahr[], aktuellesId?: string): void {
    this._kegeljahre.set(kegeljahre);
    this._aktuellesKegeljahrId.set(aktuellesId ?? kegeljahre[0]?.id ?? null);
    this.datenstandErhoehen();
  }

  addKegeljahr(kj: Kegeljahr): void {
    this._kegeljahre.update((list) => [...list, kj]);
    this._aktuellesKegeljahrId.set(kj.id);
    this.datenstandErhoehen();
  }

  setAktuellesKegeljahr(id: string): void {
    if (id === this._aktuellesKegeljahrId()) return;
    this._aktuellesKegeljahrId.set(id);
    this.datenstandErhoehen();
  }

  findKegeljahrByDatum(datum: string): Kegeljahr | undefined {
    return this._kegeljahre().find((kj) => datum >= kj.startDatum && datum <= kj.endDatum);
  }

  // ---------------------------------------------------------------
  // Mitglieder
  // ---------------------------------------------------------------

  setMitglieder(mitglieder: Mitglied[]): void {
    this._mitglieder.set(mitglieder);
    this.datenstandErhoehen();
  }

  addMitglied(m: Mitglied): void {
    this._mitglieder.update((list) => [...list, m]);
  }

  updateMitglied(m: Mitglied): void {
    this._mitglieder.update((list) => list.map((x) => (x.id === m.id ? m : x)));
  }

  deleteMitglied(id: string): void {
    this._mitglieder.update((list) => list.filter((x) => x.id !== id));
  }

  // ---------------------------------------------------------------
  // Buchungen
  // ---------------------------------------------------------------

  addBuchungen(neue: Buchung[]): void {
    this.updateAktuelles((kj) => ({ ...kj, buchungen: [...kj.buchungen, ...neue] }));
  }

  updateBuchung(b: Buchung): void {
    this.updateAktuelles((kj) => ({
      ...kj,
      buchungen: kj.buchungen.map((x) => (x.id === b.id ? b : x)),
    }));
  }

  deleteBuchung(id: string): void {
    this.updateAktuelles((kj) => ({ ...kj, buchungen: kj.buchungen.filter((x) => x.id !== id) }));
  }

  /** Entfernt mehrere Buchungen auf einmal. */
  deleteBuchungen(ids: readonly string[]): number {
    const zuLoeschen = new Set(ids);
    let entfernt = 0;
    this.updateAktuelles((kj) => {
      const behalten = kj.buchungen.filter((b) => !zuLoeschen.has(b.id));
      entfernt = kj.buchungen.length - behalten.length;
      return { ...kj, buchungen: behalten };
    });
    return entfernt;
  }

  /** Entfernt alle Buchungen, die aus der Abrechnung eines Kegelabends stammen. */
  deleteBuchungenFuerKegelabend(kegelabendId: string): number {
    let entfernt = 0;
    this.updateAktuelles((kj) => {
      const behalten = kj.buchungen.filter((b) => b.kegelabendId !== kegelabendId);
      entfernt = kj.buchungen.length - behalten.length;
      return { ...kj, buchungen: behalten };
    });
    return entfernt;
  }

  // ---------------------------------------------------------------
  // Kegelabende
  // ---------------------------------------------------------------

  addKegelabend(ka: Kegelabend): void {
    this.updateAktuelles((kj) => ({ ...kj, kegelabende: [...kj.kegelabende, ka] }));
  }

  updateKegelabend(ka: Kegelabend): void {
    this.updateAktuelles((kj) => ({
      ...kj,
      kegelabende: kj.kegelabende.map((x) => (x.id === ka.id ? ka : x)),
    }));
  }

  deleteKegelabend(id: string): void {
    this.updateAktuelles((kj) => ({
      ...kj,
      kegelabende: kj.kegelabende.filter((x) => x.id !== id),
    }));
  }

  // ---------------------------------------------------------------

  private updateAktuelles(fn: (kj: Kegeljahr) => Kegeljahr): void {
    const aktuelleId = this._aktuellesKegeljahrId();
    if (!aktuelleId) return;
    this._kegeljahre.update((list) => list.map((kj) => (kj.id === aktuelleId ? fn(kj) : kj)));
  }
}
