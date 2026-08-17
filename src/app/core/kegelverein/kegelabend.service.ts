import { inject, Service } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { berechneKegelabendErgebnisse } from './kegelabend.logic';
import { Kegelabend, KegelabendErgebnisZeile, Mitglied } from './kegelverein.models';
import { AccountingService } from './accounting.service';

/**
 * Kegelabend: kombiniert Store mit der reinen Ergebnis-/Strafenlogik.
 */
@Service()
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
   * die Buchführung — für Vereinsmitglieder wie für Gastkegler, da beide
   * als Mitglied geführt werden und ein Forderungskonto haben.
   *
   * Wurde der Abend bereits abgerechnet, wird abgebrochen statt erneut
   * gebucht. Für eine Korrektur zuerst strafenZuruecknehmen() aufrufen.
   *
   * Übersprungen werden nur Teilnehmer, deren Mitgliedseintrag inzwischen
   * gelöscht wurde; für sie gäbe es keine gültige Zuordnung.
   */
  strafenUebernehmen(ka: Kegelabend, datum: string): number {
    if (ka.strafenUebernommenAm) {
      throw new Error(
        'Die Strafen dieses Abends wurden bereits übernommen. ' +
          'Für eine Korrektur zuerst die Abrechnung zurücknehmen.',
      );
    }

    const mitgliedNachId = new Map(this.store.mitglieder().map((m) => [m.id, m]));

    const posten = berechneKegelabendErgebnisse(ka)
      .map((z) => ({ mitglied: mitgliedNachId.get(z.teilnehmerId), betrag: z.strafeGesamt }))
      .filter((p): p is { mitglied: Mitglied; betrag: number } => !!p.mitglied && p.betrag > 0);

    this.accounting.uebernehmeStrafen(datum, posten, ka.id);
    this.speichern({ ...ka, strafenUebernommenAm: new Date().toISOString() });

    return posten.length;
  }

  /**
   * Nimmt eine Strafenübernahme zurück: löscht die zugehörigen Buchungen
   * und gibt den Abend zur erneuten Abrechnung frei.
   *
   * Die Buchungen werden über kegelabendId gefunden, nicht über ihren
   * Text — dadurch bleiben von Hand ergänzte Buchungen unberührt.
   */
  strafenZuruecknehmen(ka: Kegelabend): number {
    const entfernt = this.accounting.loescheStrafenFuerKegelabend(ka.id);

    const { strafenUebernommenAm: _weg, ...ohneMarkierung } = ka;
    this.speichern(ohneMarkierung);

    return entfernt;
  }
}
