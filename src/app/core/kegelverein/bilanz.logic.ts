import { Buchung, Kegeljahr, KontoNummer } from './kegelverein.models';
import { berechneSalden } from './accounting.logic';

/**
 * Bilanz und Gewinn- und Verlustrechnung eines Kegeljahres.
 *
 * Aufbau nach dem Muster der bisherigen Anhänge zur Generalversammlung:
 * Eröffnungsbilanz, Schlussbilanz, GuV.
 *
 * Die Eröffnungsbilanz entsteht allein aus den Eröffnungsbuchungen, also
 * denen, die über das Eröffnungsbilanzkonto (000) laufen. Die Schlussbilanz
 * berücksichtigt sämtliche Buchungen des Jahres.
 */

export interface BilanzSeite {
  forderungen: number;
  kasse: number;
  summeAktiva: number;
  vereinsvermoegen: number;
  restguthaben: number;
  schulden: number;
  summePassiva: number;
  /** Aktiva minus Passiva; muss null sein. */
  differenz: number;
}

export interface GuV {
  beitraege: number;
  strafen: number;
  umlagen: number;
  sonstigeErtraege: number;
  ertraegeGesamt: number;
  kegelbahn: number;
  vereinsrunden: number;
  generalversammlung: number;
  sonstigeAufwendungen: number;
  aufwendungenGesamt: number;
  /** Positiv = Überschuss, negativ = Fehlbetrag. */
  ergebnis: number;
}

export interface Jahresbericht {
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
  eroeffnungsbilanz: BilanzSeite;
  schlussbilanz: BilanzSeite;
  guv: GuV;
  /**
   * Gegenprobe: Die Veränderung des Vereinsvermögens zwischen beiden
   * Bilanzen muss dem Jahresergebnis entsprechen. Weicht das ab, fehlen
   * Buchungen oder das Eröffnungsbilanzkonto ging nicht auf.
   */
  probe: {
    vermoegensaenderung: number;
    ergebnis: number;
    stimmt: boolean;
  };
}

function runde(n: number): number {
  return Math.abs(n) < 0.005 ? 0 : Math.round(n * 100) / 100;
}

function bilanzAus(buchungen: Buchung[]): BilanzSeite {
  const salden = berechneSalden(buchungen);
  const soll = (k: KontoNummer) => salden[k].soll - salden[k].haben;
  const haben = (k: KontoNummer) => salden[k].haben - salden[k].soll;

  const forderungen = runde(soll('100'));
  const kasse = runde(soll('110'));
  const vereinsvermoegen = runde(haben('200'));
  const restguthaben = runde(haben('210'));
  const schulden = runde(haben('220'));

  const summeAktiva = runde(forderungen + kasse);
  const summePassiva = runde(vereinsvermoegen + restguthaben + schulden);

  return {
    forderungen,
    kasse,
    summeAktiva,
    vereinsvermoegen,
    restguthaben,
    schulden,
    summePassiva,
    differenz: runde(summeAktiva - summePassiva),
  };
}

/**
 * Eröffnungsbuchungen sind die, die das Eröffnungsbilanzkonto berühren.
 * Sie bilden den Bestand ab, der aus dem Vorjahr übernommen wurde.
 */
function eroeffnungsbuchungen(buchungen: Buchung[]): Buchung[] {
  return buchungen.filter((b) => b.sollKonto === '000' || b.habenKonto === '000');
}

export function erzeugeJahresbericht(kegeljahr: Kegeljahr): Jahresbericht {
  const alle = kegeljahr.buchungen;
  const salden = berechneSalden(alle);
  const haben = (k: KontoNummer) => runde(salden[k].haben - salden[k].soll);
  const soll = (k: KontoNummer) => runde(salden[k].soll - salden[k].haben);

  const beitraege = haben('300');
  const strafen = haben('310');
  const umlagen = haben('320');
  const sonstigeErtraege = haben('330');
  const ertraegeGesamt = runde(beitraege + strafen + umlagen + sonstigeErtraege);

  const kegelbahn = soll('400');
  const vereinsrunden = soll('410');
  const generalversammlung = soll('420');
  const sonstigeAufwendungen = soll('430');
  const aufwendungenGesamt = runde(
    kegelbahn + vereinsrunden + generalversammlung + sonstigeAufwendungen,
  );

  const guv: GuV = {
    beitraege,
    strafen,
    umlagen,
    sonstigeErtraege,
    ertraegeGesamt,
    kegelbahn,
    vereinsrunden,
    generalversammlung,
    sonstigeAufwendungen,
    aufwendungenGesamt,
    ergebnis: runde(ertraegeGesamt - aufwendungenGesamt),
  };

  const eroeffnungsbilanz = bilanzAus(eroeffnungsbuchungen(alle));
  const schlussbilanz = bilanzAus(alle);

  const vermoegensaenderung = runde(
    schlussbilanz.vereinsvermoegen - eroeffnungsbilanz.vereinsvermoegen,
  );

  return {
    bezeichnung: kegeljahr.bezeichnung,
    startDatum: kegeljahr.startDatum,
    endDatum: kegeljahr.endDatum,
    eroeffnungsbilanz,
    schlussbilanz,
    guv,
    probe: {
      vermoegensaenderung,
      ergebnis: guv.ergebnis,
      stimmt: Math.abs(vermoegensaenderung - guv.ergebnis) < 0.005,
    },
  };
}
