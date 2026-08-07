import { Injectable, computed, inject } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import {
  berechneMitgliedFinanzen,
  berechneSalden,
  erstelleBuchung,
  journalEinnahmen,
  journalGeburtstagsumlage,
  journalMonatsbeitraege,
  journalRestguthabenVerrechnung,
  journalStrafen,
} from './accounting.logic';
import { Buchung, KontoNummer, Mitglied } from './kegelverein.models';

/**
 * Buchhaltung: kombiniert Store-Daten (buchungen$) mit der reinen Logik
 * aus accounting.logic.ts. Komponenten injizieren nur diesen Service,
 * nie den Store direkt für Buchhaltungs-Fragen.
 */
@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly store = inject(KegeljahrStore);

  readonly buchungen = this.store.buchungen;
  readonly salden = computed(() => berechneSalden(this.buchungen()));

  readonly finanzenAlleMitglieder = computed(() =>
    this.store.mitglieder().map((m) => berechneMitgliedFinanzen(m.id, this.buchungen())),
  );

  finanzenFuerMitglied(mitgliedId: string) {
    return computed(() => berechneMitgliedFinanzen(mitgliedId, this.buchungen()));
  }

  // --- Geschäftsvorfälle ---

  bucheMonatsbeitraege(datum: string, beitragAktiv?: number, beitragPassiv?: number): void {
    const buchungen = journalMonatsbeitraege({
      datum,
      mitglieder: this.store.mitglieder(),
      beitragAktiv,
      beitragPassiv,
    });
    this.store.addBuchungen(buchungen);
  }

  uebernehmeStrafen(datum: string, posten: { mitglied: Mitglied; betrag: number }[]): void {
    this.store.addBuchungen(journalStrafen({ datum, posten }));
  }

  verrechneRestguthaben(datum: string): void {
    const buchungen = journalRestguthabenVerrechnung({
      datum,
      mitglieder: this.store.mitglieder(),
      buchungen: this.buchungen(),
    });
    this.store.addBuchungen(buchungen);
  }

  bucheEinnahmen(datum: string, zahlungen: { mitglied: Mitglied; betrag: number }[]): void {
    const buchungen = journalEinnahmen({ datum, zahlungen, buchungen: this.buchungen() });
    this.store.addBuchungen(buchungen);
  }

  bucheGeburtstagsumlage(
    datum: string,
    ausrichter: Mitglied,
    gaeste: { mitglied: Mitglied; anzahlZusatzpersonen: number }[],
  ): void {
    this.store.addBuchungen(journalGeburtstagsumlage({ datum, ausrichter, gaeste }));
  }

  /**
   * Freie Einzelbuchung, z.B. Bahnmiete oder Vereinsrunde. Für alles, was
   * keinem der vorgefertigten Geschäftsvorfälle entspricht.
   */
  bucheManuell(input: {
    datum: string;
    sollKonto: KontoNummer;
    habenKonto: KontoNummer;
    betrag: number;
    buchungstext: string;
    mitgliedId?: string;
  }): void {
    this.store.addBuchungen([erstelleBuchung(input)]);
  }

  /**
   * Ändert eine bestehende Buchung. Nützlich vor allem, um eine fehlende
   * Mitgliedszuordnung nachzutragen — Löschen und Neuanlegen würde die
   * Buchungs-id ändern und damit den Bezug zu Backups erschweren.
   */
  buchungAktualisieren(b: Buchung): void {
    this.store.updateBuchung(b);
  }

  /**
   * Ändert eine bestehende Buchung. Die id bleibt erhalten, damit Verweise
   * und Sortierung stabil bleiben.
   */
  aktualisiereBuchung(buchung: Buchung): void {
    this.store.updateBuchung(buchung);
  }

  loescheBuchung(id: string): void {
    this.store.deleteBuchung(id);
  }
}
