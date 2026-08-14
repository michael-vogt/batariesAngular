import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { berechneSalden } from '../../../core/kegelverein/accounting.logic';
import { KONTENRAHMEN, KontoArt, KontoNummer } from '../../../core/kegelverein/kegelverein.models';
import { datumKurz, euro } from '../../../shared/format.util';

interface KontoZeile {
  nummer: KontoNummer;
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
  imports: [FormsModule],
  templateUrl: './konten-uebersicht.component.html',
  styleUrl: './konten-uebersicht.component.scss',
})
export class KontenUebersichtComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumKurz = datumKurz;
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly datumVon = signal('');
  protected readonly datumBis = signal('');

  protected readonly istGefiltert = computed(() => !!this.datumVon() || !!this.datumBis());

  protected readonly gefilterteBuchungen = computed(() => {
    const von = this.datumVon();
    const bis = this.datumBis();
    if (!von && !bis) return this.accounting.buchungen();

    // ISO-Daten sind als Zeichenketten korrekt vergleichbar.
    return this.accounting
      .buchungen()
      .filter((b) => (!von || b.datum >= von) && (!bis || b.datum <= bis));
  });

  /**
   * Salden werden hier lokal gerechnet statt über AccountingService.salden(),
   * weil dieser immer das gesamte Kegeljahr auswertet. Dieselbe reine
   * Funktion, nur mit eingeschränkter Buchungsmenge.
   */
  private readonly salden = computed(() => berechneSalden(this.gefilterteBuchungen()));

  protected readonly anzahlBuchungen = computed(() => this.gefilterteBuchungen().length);
  protected readonly anzahlGesamt = computed(() => this.accounting.buchungen().length);

  /** Zeitraum auf das Kegeljahr zurücksetzen. */
  protected zeitraumZuruecksetzen(): void {
    this.datumVon.set('');
    this.datumBis.set('');
  }

  protected ganzesJahrSetzen(): void {
    const jahr = this.daten.aktuellesJahr();
    if (!jahr) return;
    this.datumVon.set(jahr.startDatum);
    this.datumBis.set(jahr.endDatum);
  }

  private readonly zeilen = computed<KontoZeile[]>(() => {
    const salden = this.salden();
    return KONTENRAHMEN.map((konto) => {
      const { soll, haben } = salden[konto.nummer];
      // Aktiv- und Aufwandskonten haben Sollsaldo, Passiv- und
      // Ertragskonten Habensaldo. Vereinsvermögen (200) und GuV (250)
      // sind formal "Sonstige", verhalten sich aber habenseitig — ohne
      // Sonderfall stünden sie mit negativem Vorzeichen da, während die
      // Gegenprobe darunter denselben Wert positiv ausweist.
      const habenseitig =
        konto.art === 'Passiv' ||
        konto.art === 'Ertrag' ||
        konto.nummer === '200' ||
        konto.nummer === '250';
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

  /** Ertragsüberschuss bzw. -fehlbetrag im ausgewerteten Zeitraum. */
  protected readonly ergebnis = computed(() => {
    const salden = this.salden();
    return salden['250'].haben - salden['250'].soll;
  });

  /**
   * Bilanzprobe: Vermögen = Verbindlichkeiten + Vereinsvermögen (inkl.
   * Ergebnis). Sie gilt auch für Teilzeiträume, weil jede Buchung beide
   * Seiten gleichermaßen erhöht — geht sie nicht auf, fehlt eine
   * Gegenbuchung oder das Eröffnungsbilanzkonto wurde nicht ausgeglichen.
   */
  protected readonly probe = computed(() => {
    const salden = this.salden();
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
}
