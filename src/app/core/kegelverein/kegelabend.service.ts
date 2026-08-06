import { Injectable, inject } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { berechneKegelabendErgebnisse } from './kegelabend.logic';
import { Kegelabend, KegelabendErgebnisZeile, Mitglied } from './kegelverein.models';
import { AccountingService } from './accounting.service';

/**
 * Kegelabend: kombiniert Store mit der reinen Ergebnis-/Strafenlogik.
 */
@Injectable({ providedIn: 'root' })
export class KegelabendService {
  private readonly store = inject(KegeljahrStore);
  private readonly accounting = inject(AccountingService);

  readonly kegelabende = this.store.kegelabende;

  /**
   * Kein computed(): der Kegelabend kommt als Parameter, nicht als Signal.
   * Aufrufer, die Reaktivität brauchen, wickeln den Aufruf selbst in ein
   * computed() um ihre eigene Signal-Quelle.
   */
  ergebnisse(ka: Kegelabend): KegelabendErgebnisZeile[] {
    return berechneKegelabendErgebnisse(ka);
  }

  speichern(ka: Kegelabend): void {
    const existiert = this.store.kegelabende().some((x) => x.id === ka.id);
    existiert ? this.store.updateKegelabend(ka) : this.store.addKegelabend(ka);
  }

  loeschen(id: string): void {
    this.store.deleteKegelabend(id);
  }

  /**
   * Überträgt die berechneten Strafen eines Kegelabends als Buchungen in
   * die Buchführung. Teilnehmer, die keine Mitglieder sind (Gäste), werden
   * übersprungen — für sie gibt es kein Forderungskonto.
   */
  strafenUebernehmen(ka: Kegelabend, datum: string): number {
    const mitgliedNachId = new Map(this.store.mitglieder().map((m) => [m.id, m]));

    const posten = berechneKegelabendErgebnisse(ka)
      .map((z) => ({ mitglied: mitgliedNachId.get(z.teilnehmerId), betrag: z.strafeGesamt }))
      .filter((p): p is { mitglied: Mitglied; betrag: number } => !!p.mitglied && p.betrag > 0);

    this.accounting.uebernehmeStrafen(datum, posten);
    return posten.length;
  }
}
