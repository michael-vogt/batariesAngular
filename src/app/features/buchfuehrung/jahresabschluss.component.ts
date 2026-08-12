import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { AbschlussVorschau } from '../../core/kegelverein/jahresabschluss.logic';
import { datumKurz, euro } from '../../shared/format.util';

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
