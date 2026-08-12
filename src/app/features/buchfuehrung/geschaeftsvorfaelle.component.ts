import {
  Component,
  computed,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import {
  journalMonatsbeitraege,
  journalRestguthabenVerrechnung,
} from '../../core/kegelverein/accounting.logic';
import { aktuellerStatus, istGastkegler } from '../../core/kegelverein/mitglied.util';
import { Mitglied } from '../../core/kegelverein/kegelverein.models';
import { euro } from '../../shared/format.util';

type Vorgang = 'beitraege' | 'einnahmen' | 'restguthaben' | 'geburtstag';

const HEUTE = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-geschaeftsvorfaelle',
  imports: [FormsModule],
  templateUrl: './geschaeftsvorfaelle.component.html',
  styleUrl: './geschaeftsvorfaelle.component.scss',
})
export class GeschaeftsvorfaelleComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  private readonly accounting = inject(AccountingService);
  protected readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  constructor() {
    // Läuft bei jedem vollständigen Datenaustausch (Laden, Verwerfen,
    // Jahreswechsel) und räumt die Bedienzustände auf.
    effect(() => {
      this.daten.datenstand();
      this.bedienzustandZuruecksetzen();
    });
  }

  protected readonly aktiverVorgang = signal<Vorgang>('beitraege');
  protected readonly meldung = signal<string | null>(null);
  protected readonly speichert = signal(false);

  protected readonly mitglieder = this.mitgliederService.mitglieder;

  /** Ohne Gastkegler und Ausgetretene — für Auswahllisten. */
  protected readonly vereinsmitglieder = computed(() =>
    this.mitglieder().filter((m) => {
      const status = aktuellerStatus(m);
      return status === 'aktiv' || status === 'passiv';
    }),
  );

  // ---------------------------------------------------------------
  // Monatsbeiträge
  // ---------------------------------------------------------------

  protected readonly beitragDatum = signal(HEUTE());
  protected readonly beitragAktiv = signal(8);
  protected readonly beitragPassiv = signal(1);

  /**
   * Vorschau über die reine Journalfunktion — dieselbe Logik, die auch
   * gebucht wird. So kann die Anzeige nicht von der Buchung abweichen.
   */
  protected readonly beitragVorschau = computed(() =>
    journalMonatsbeitraege({
      datum: this.beitragDatum(),
      mitglieder: this.mitglieder(),
      beitragAktiv: this.beitragAktiv(),
      beitragPassiv: this.beitragPassiv(),
    }),
  );

  protected readonly beitragSumme = computed(() =>
    this.beitragVorschau().reduce((s, b) => s + b.betrag, 0),
  );

  protected beitraegeBuchen(): void {
    const anzahl = this.beitragVorschau().length;
    if (anzahl === 0) return;

    if (!this.fortfahrenWennGewaehltesDatumHeute())
      return;

    if (!confirm(`${anzahl} Monatsbeiträge über ${this.euro(this.beitragSumme())} € buchen?`))
      return;

    this.accounting.bucheMonatsbeitraege(
      this.beitragDatum(),
      this.beitragAktiv(),
      this.beitragPassiv(),
    );
    this.fertig(`${anzahl} Monatsbeiträge gebucht.`);
  }

  // ---------------------------------------------------------------
  // Zahlungseingänge
  // ---------------------------------------------------------------

  protected readonly einnahmeDatum = signal(HEUTE());
  /**
   * Eingegebene Beträge je Mitglieds-id. Bewusst `number | undefined`:
   * für die meisten Mitglieder existiert kein Eintrag, und ein Typ, der
   * das verschweigt, führt zu falschen Annahmen im Template.
   */
  protected readonly zahlungen = signal<Record<string, number | undefined>>({});

  /** Eingetragener Betrag oder null, wenn nichts erfasst wurde. */
  protected zahlungVon(mitgliedId: string): number | null {
    return this.zahlungen()[mitgliedId] ?? null;
  }

  protected readonly offeneposten = computed(() => {
    const finanzen = this.accounting.finanzenAlleMitglieder();
    return this.mitglieder()
      .map((m) => ({
        mitglied: m,
        offen: finanzen.find((f) => f.mitgliedId === m.id)?.offeneForderungenGesamt ?? 0,
      }))
      .filter((z) => z.offen > 0 || (this.zahlungVon(z.mitglied.id) ?? 0) > 0)
      .sort((a, b) => b.offen - a.offen);
  });

  protected readonly zahlungSumme = computed(() =>
    Object.values(this.zahlungen()).reduce<number>((s, betrag) => s + (betrag ?? 0), 0),
  );

  protected zahlungGeaendert(mitgliedId: string, wert: unknown): void {
    const betrag = Math.max(0, Number(wert) || 0);
    this.zahlungen.update((alle) => ({ ...alle, [mitgliedId]: betrag }));
  }

  protected offenenBetragUebernehmen(mitgliedId: string, offen: number): void {
    this.zahlungen.update((alle) => ({ ...alle, [mitgliedId]: offen }));
  }

  protected einnahmenBuchen(): void {
    const eintraege = Object.entries(this.zahlungen())
      .filter((eintrag): eintrag is [string, number] => (eintrag[1] ?? 0) > 0)
      .map(([id, betrag]) => ({
        mitglied: this.mitglieder().find((m) => m.id === id),
        betrag,
      }))
      .filter((z): z is { mitglied: Mitglied; betrag: number } => !!z.mitglied);

    if (eintraege.length === 0) return;
    if (!confirm(`Zahlungseingänge über ${this.euro(this.zahlungSumme())} € buchen?`)) return;

    this.accounting.bucheEinnahmen(this.einnahmeDatum(), eintraege);
    this.zahlungen.set({});
    this.fertig(`Zahlungseingänge von ${eintraege.length} Mitgliedern gebucht.`);
  }

  // ---------------------------------------------------------------
  // Restguthaben verrechnen
  // ---------------------------------------------------------------

  protected readonly verrechnungDatum = signal(HEUTE());

  protected readonly verrechnungVorschau = computed(() =>
    journalRestguthabenVerrechnung({
      datum: this.verrechnungDatum(),
      mitglieder: this.mitglieder(),
      buchungen: this.accounting.buchungen(),
    }),
  );

  /** Betroffene Mitglieder mit dem Betrag, der verrechnet würde. */
  protected readonly verrechnungZeilen = computed(() => {
    const summen = new Map<string, number>();
    for (const b of this.verrechnungVorschau()) {
      // Je Verrechnung entstehen zwei Buchungen; nur eine Richtung zählen.
      if (b.sollKonto !== '210') continue;
      summen.set(b.mitgliedId!, (summen.get(b.mitgliedId!) ?? 0) + b.betrag);
    }
    return [...summen.entries()].map(([id, betrag]) => ({
      name: this.mitglieder().find((m) => m.id === id)?.name ?? 'unbekannt',
      betrag,
    }));
  });

  protected verrechnungBuchen(): void {
    const zeilen = this.verrechnungZeilen();
    if (zeilen.length === 0) return;

    const summe = zeilen.reduce((s, z) => s + z.betrag, 0);
    if (!confirm(`Restguthaben über ${this.euro(summe)} € mit offenen Forderungen verrechnen?`))
      return;

    this.accounting.verrechneRestguthaben(this.verrechnungDatum());
    this.fertig(`Restguthaben von ${zeilen.length} Mitgliedern verrechnet.`);
  }

  // ---------------------------------------------------------------
  // Geburtstagsumlage
  // ---------------------------------------------------------------

  protected readonly geburtstagDatum = signal(HEUTE());
  protected readonly ausrichterId = signal('');
  /** Zusatzpersonen je Gast-Mitglieds-id; vorhandener Eintrag = nimmt teil. */
  protected readonly gaeste = signal<Record<string, number | undefined>>({});

  /** Zusatzpersonen eines Teilnehmers, 0 wenn nicht erfasst. */
  protected zusatzVon(mitgliedId: string): number {
    return this.gaeste()[mitgliedId] ?? 0;
  }

  /** Umlagebetrag eines Teilnehmers: 10 € je Person inklusive ihm selbst. */
  protected umlageFuer(mitgliedId: string): number {
    return 10 * (this.zusatzVon(mitgliedId) + 1);
  }

  protected readonly moeglicheGaeste = computed(() =>
    this.mitglieder().filter((m) => m.id !== this.ausrichterId() && !istGastkegler(m)),
  );

  protected readonly umlageSumme = computed(() =>
    Object.values(this.gaeste()).reduce<number>((s, zusatz) => s + 10 * ((zusatz ?? 0) + 1), 0),
  );

  protected istGast(id: string): boolean {
    return id in this.gaeste();
  }

  protected gastUmschalten(id: string, event: Event): void {
    const an = (event.target as HTMLInputElement).checked;
    this.gaeste.update((alle) => {
      if (an) return { ...alle, [id]: 0 };
      const { [id]: _weg, ...rest } = alle;
      return rest;
    });
  }

  protected zusatzGeaendert(id: string, wert: unknown): void {
    const zahl = Math.max(0, Number(wert) || 0);
    this.gaeste.update((alle) => ({ ...alle, [id]: zahl }));
  }

  protected umlageBuchen(): void {
    const ausrichter = this.mitglieder().find((m) => m.id === this.ausrichterId());
    const eintraege = Object.entries(this.gaeste())
      .map(([id, zusatz]) => ({
        mitglied: this.mitglieder().find((m) => m.id === id),
        anzahlZusatzpersonen: zusatz ?? 0,
      }))
      .filter((z): z is { mitglied: Mitglied; anzahlZusatzpersonen: number } => !!z.mitglied);

    if (!ausrichter || eintraege.length === 0) return;
    if (
      !confirm(
        `Geburtstagsumlage über ${this.euro(this.umlageSumme())} € für ${ausrichter.name} buchen?`,
      )
    )
      return;

    this.accounting.bucheGeburtstagsumlage(this.geburtstagDatum(), ausrichter, eintraege);
    this.gaeste.set({});
    this.ausrichterId.set('');
    this.fertig(`Geburtstagsumlage für ${ausrichter.name} gebucht.`);
  }

  // ---------------------------------------------------------------

  protected name(m: Mitglied): string {
    return m.name;
  }

  private fertig(text: string): void {
    this.daten.aenderungVorgemerkt();
    this.meldung.set(`${text} Zum Sichern noch „Änderungen speichern“ drücken.`);
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
      this.meldung.set(null);
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }

  private bedienzustandZuruecksetzen(): void {
    // Erfasste Beträge gelten für den alten Stand der offenen Posten.
    this.zahlungen.set({});
    this.gaeste.set({});
    this.ausrichterId.set('');
    this.meldung.set(null);
  }

  private fortfahrenWennGewaehltesDatumHeute(): boolean {
    // gewähltes Datum ist nicht heute, daher keine Überprüfung notwendig
    if (this.beitragDatum() !== HEUTE())
      return false;

    return confirm('Achtung: Das gewählte Datum ist heute! Fortfahren?');
  }
}
