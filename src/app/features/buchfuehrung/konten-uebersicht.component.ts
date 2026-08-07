import { Component, computed, inject } from '@angular/core';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { KONTENRAHMEN, KontoArt, KontoNummer } from '../../core/kegelverein/kegelverein.models';

interface KontoZeile {
  nummer: string;
  name: string;
  soll: number;
  haben: number;
  /** Vorzeichenbehafteter Saldo in der für die Kontoart üblichen Richtung. */
  saldo: number;
}

interface KontoGruppe {
  titel: string;
  zeilen: KontoZeile[];
  summe: number;
}

@Component({
  selector: 'app-konten-uebersicht',
  templateUrl: './konten-uebersicht.component.html',
  styleUrl: './konten-uebersicht.component.scss',
})
export class KontenUebersichtComponent {
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  private readonly zeilen = computed<KontoZeile[]>(() => {
    const salden = this.accounting.salden();
    return KONTENRAHMEN.map((konto) => {
      const { soll, haben } = salden[konto.nummer];
      // Aktiv- und Aufwandskonten haben Sollsaldo, Passiv- und
      // Ertragskonten Habensaldo. Damit alle Zahlen positiv und
      // vergleichbar erscheinen, wird je Art gedreht.
      const habenseitig = konto.art === 'Passiv' || konto.art === 'Ertrag';
      return {
        nummer: konto.nummer,
        name: konto.name,
        soll,
        haben,
        saldo: habenseitig ? haben - soll : soll - haben,
      };
    });
  });

  protected readonly gruppen = computed<KontoGruppe[]>(() => {
    const alle = this.zeilen();
    const nach = (art: KontoArt) =>
      alle.filter((z) => KONTENRAHMEN.find((k) => k.nummer === z.nummer)!.art === art);

    const bauen = (titel: string, zeilen: KontoZeile[]): KontoGruppe => ({
      titel,
      zeilen,
      summe: zeilen.reduce((s, z) => s + z.saldo, 0),
    });

    return [
      bauen('Vermögen (Aktiva)', nach('Aktiv')),
      bauen('Verbindlichkeiten (Passiva)', nach('Passiv')),
      bauen('Erträge', nach('Ertrag')),
      bauen('Aufwendungen', nach('Aufwand')),
      bauen('Sonstige', [...nach('Sonstige'), ...nach('GuV')]),
    ].filter((g) => g.zeilen.some((z) => z.soll !== 0 || z.haben !== 0));
  });

  /** Ertragsüberschuss bzw. -fehlbetrag des laufenden Jahres. */
  protected readonly ergebnis = computed(() => {
    const salden = this.accounting.salden();
    return salden['250'].haben - salden['250'].soll;
  });

  /**
   * Bilanzprobe: Vermögen = Verbindlichkeiten + Vereinsvermögen (inkl.
   * Jahresergebnis). Geht das nicht auf, fehlen Gegenbuchungen oder das
   * Eröffnungsbilanzkonto wurde beim Jahreswechsel nicht ausgeglichen.
   *
   * Bewusst nicht die Summe aller Soll- gegen alle Habenbeträge: die ist
   * per Konstruktion immer gleich (jede Buchung erhöht beide um denselben
   * Betrag) und würde daher nie etwas aufdecken.
   */
  protected readonly probe = computed(() => {
    const salden = this.accounting.salden();
    const sollseitig = (nummer: KontoNummer) => salden[nummer].soll - salden[nummer].haben;
    const habenseitig = (nummer: KontoNummer) => salden[nummer].haben - salden[nummer].soll;

    const aktiva = sollseitig('100') + sollseitig('110');
    const passiva = habenseitig('210') + habenseitig('220');
    const eigenkapital = habenseitig('200');
    const eroeffnungsrest = sollseitig('000');
    const differenz = aktiva - passiva - eigenkapital + eroeffnungsrest;

    return {
      aktiva,
      passiva,
      eigenkapital,
      eroeffnungsrest,
      differenz,
      stimmt: Math.abs(differenz) < 0.005,
    };
  });

  protected readonly anzahlBuchungen = computed(() => this.accounting.buchungen().length);

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
