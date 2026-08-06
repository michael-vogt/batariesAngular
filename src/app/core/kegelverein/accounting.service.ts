import { Injectable, computed, inject } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import {
  berechneMitgliedFinanzen,
  berechneSalden,
  journalEinnahmen,
  journalGeburtstagsumlage,
  journalMonatsbeitraege,
  journalRestguthabenVerrechnung,
  journalStrafen,
} from './accounting.logic';
import { Mitglied } from './kegelverein.models';

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

  loescheBuchung(id: string): void {
    this.store.deleteBuchung(id);
  }
}
