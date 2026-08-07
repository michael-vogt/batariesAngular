import { Component, computed, inject, signal } from '@angular/core';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { AbschlussVorschau } from '../../core/kegelverein/jahresabschluss.logic';

@Component({
  selector: 'app-jahresabschluss',
  templateUrl: './jahresabschluss.component.html',
  styleUrl: './jahresabschluss.component.scss',
})
export class JahresabschlussComponent {
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly vorschau = signal<AbschlussVorschau | null>(null);
  protected readonly pruefFehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly abgeschlossen = signal(false);

  protected readonly aktuellesJahr = this.daten.aktuellesJahr;

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

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected datumKurz(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE');
  }
}
