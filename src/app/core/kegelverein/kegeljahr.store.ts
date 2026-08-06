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

  readonly kegeljahre = this._kegeljahre.asReadonly();
  readonly aktuellesKegeljahrId = this._aktuellesKegeljahrId.asReadonly();

  readonly aktuellesKegeljahr = computed(
    () => this._kegeljahre().find((kj) => kj.id === this._aktuellesKegeljahrId()) ?? null,
  );

  readonly mitglieder = computed(() => this.aktuellesKegeljahr()?.mitglieder ?? []);
  readonly buchungen = computed(() => this.aktuellesKegeljahr()?.buchungen ?? []);
  readonly kegelabende = computed(() => this.aktuellesKegeljahr()?.kegelabende ?? []);

  // ---------------------------------------------------------------
  // Kegeljahr
  // ---------------------------------------------------------------

  setKegeljahre(kegeljahre: Kegeljahr[], aktuellesId?: string): void {
    this._kegeljahre.set(kegeljahre);
    this._aktuellesKegeljahrId.set(aktuellesId ?? kegeljahre[0]?.id ?? null);
  }

  addKegeljahr(kj: Kegeljahr): void {
    this._kegeljahre.update((list) => [...list, kj]);
    this._aktuellesKegeljahrId.set(kj.id);
  }

  setAktuellesKegeljahr(id: string): void {
    this._aktuellesKegeljahrId.set(id);
  }

  findKegeljahrByDatum(datum: string): Kegeljahr | undefined {
    return this._kegeljahre().find((kj) => datum >= kj.startDatum && datum <= kj.endDatum);
  }

  // ---------------------------------------------------------------
  // Mitglieder
  // ---------------------------------------------------------------

  addMitglied(m: Mitglied): void {
    this.updateAktuelles((kj) => ({ ...kj, mitglieder: [...kj.mitglieder, m] }));
  }

  updateMitglied(m: Mitglied): void {
    this.updateAktuelles((kj) => ({
      ...kj,
      mitglieder: kj.mitglieder.map((x) => (x.id === m.id ? m : x)),
    }));
  }

  deleteMitglied(id: string): void {
    this.updateAktuelles((kj) => ({ ...kj, mitglieder: kj.mitglieder.filter((x) => x.id !== id) }));
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
