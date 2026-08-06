import { Injectable, computed, inject } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { berechneKegelabendErgebnisse } from './kegelabend.logic';
import { Kegelabend, Mitglied } from './kegelverein.models';
import { AccountingService } from './accounting.service';

/**
 * Kegelabend: kombiniert Store mit der reinen Ergebnis-/Strafenlogik.
 */
@Injectable({ providedIn: 'root' })
export class KegelabendService {
  private readonly store = inject(KegeljahrStore);

  readonly kegelabende = this.store.kegelabende;

  ergebnisse(ka: Kegelabend) {
    return computed(() => berechneKegelabendErgebnisse(ka));
  }

  speichern(ka: Kegelabend): void {
    const existiert = this.store.kegelabende().some((x) => x.id === ka.id);
    existiert ? this.store.updateKegelabend(ka) : this.store.addKegelabend(ka);
  }

  loeschen(id: string): void {
    this.store.deleteKegelabend(id);
  }

  /**
   * Übergibt die berechneten Strafen eines Kegelabends direkt an die
   * Buchhaltung (verbindet KegelabendService mit AccountingService).
   */
  strafenUebernehmen(
    ka: Kegelabend,
    datum: string,
    mitgliederNachTeilnehmerId: Map<string, Mitglied>,
    accounting: AccountingService,
  ): void {
    const ergebnisse = berechneKegelabendErgebnisse(ka);
    const posten = ergebnisse
      .map((z) => ({
        mitglied: mitgliederNachTeilnehmerId.get(z.teilnehmerId),
        betrag: z.strafeGesamt,
      }))
      .filter((p): p is { mitglied: Mitglied; betrag: number } => !!p.mitglied && p.betrag > 0);

    accounting.uebernehmeStrafen(datum, posten);
  }
}
