import { Buchung, Kegeljahr, Mitglied } from './kegelverein.models';
import { berechneMitgliedFinanzen, berechneSalden, erstelleBuchung } from './accounting.logic';

/**
 * Abschluss eines Kegeljahres: erzeugt das Folgejahr samt der
 * Eröffnungsbuchungen, die den Bestand übertragen.
 *
 * Übertragen werden Vereinsvermögen, Kassenbestand sowie je Mitglied
 * offene Forderungen und Restguthaben. Erträge und Aufwendungen werden
 * NICHT übertragen — sie sind im Vereinsvermögen bereits verrechnet und
 * beginnen im neuen Jahr wieder bei null.
 *
 * Reine Funktion ohne Store-Zugriff, damit sich die Buchungen vor dem
 * Ausführen anzeigen und prüfen lassen.
 */

export interface AbschlussVorschau {
  neuesKegeljahr: Kegeljahr;
  eroeffnungsbuchungen: Buchung[];
  /** Summe, die über das Eröffnungsbilanzkonto läuft; muss aufgehen. */
  ebkSoll: number;
  ebkHaben: number;
  ausgeglichen: boolean;
  warnungen: string[];
}

/** Centgenau runden; vermeidet Restwerte aus Gleitkomma-Arithmetik. */
function runde(n: number): number {
  return Math.abs(n) < 0.005 ? 0 : Math.round(n * 100) / 100;
}

function naechsterTag(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function einJahrSpaeter(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function bezeichnungFuer(startDatum: string, endDatum: string): string {
  return `Kegeljahr ${startDatum.slice(0, 4)}/${endDatum.slice(0, 4)}`;
}

export function bereiteAbschlussVor(params: {
  altesJahr: Kegeljahr;
  mitglieder: Mitglied[];
  /** Alle bereits vorhandenen Jahre — zur Prüfung auf Überschneidung. */
  vorhandeneJahre: Kegeljahr[];
}): AbschlussVorschau {
  const { altesJahr, mitglieder, vorhandeneJahre } = params;
  const warnungen: string[] = [];

  const startDatum = naechsterTag(altesJahr.endDatum);
  const endDatum = einJahrSpaeter(altesJahr.endDatum);

  const kollision = vorhandeneJahre.find(
    (kj) => kj.id !== altesJahr.id && startDatum >= kj.startDatum && startDatum <= kj.endDatum,
  );
  if (kollision) {
    throw new Error(
      `Das Folgejahr „${kollision.bezeichnung}“ existiert bereits. Der Abschluss ist nicht möglich.`,
    );
  }

  const salden = berechneSalden(altesJahr.buchungen);
  const buchungen: Buchung[] = [];

  const vereinsvermoegen = salden['200'].haben - salden['200'].soll;
  const kasse = salden['110'].soll - salden['110'].haben;

  if (vereinsvermoegen !== 0) {
    buchungen.push(
      erstelleBuchung({
        datum: startDatum,
        sollKonto: '000',
        habenKonto: '200',
        betrag: Math.abs(vereinsvermoegen),
        buchungstext: 'Eröffnungsbuchung Vereinsvermögen',
      }),
    );
    if (vereinsvermoegen < 0) {
      warnungen.push('Das Vereinsvermögen ist negativ — bitte die Vorjahreszahlen prüfen.');
    }
  }

  if (kasse !== 0) {
    buchungen.push(
      erstelleBuchung({
        datum: startDatum,
        sollKonto: '110',
        habenKonto: '000',
        betrag: Math.abs(kasse),
        buchungstext: 'Eröffnungsbuchung Kasse',
      }),
    );
    if (kasse < 0)
      warnungen.push('Der Kassenbestand ist negativ — bitte die Vorjahreszahlen prüfen.');
  }

  for (const m of mitglieder) {
    const finanzen = berechneMitgliedFinanzen(m.id, altesJahr.buchungen);

    if (finanzen.restguthaben > 0) {
      buchungen.push(
        erstelleBuchung({
          datum: startDatum,
          sollKonto: '000',
          habenKonto: '210',
          betrag: finanzen.restguthaben,
          buchungstext: `Eröffnungsbuchung Restguthaben`,
          mitgliedId: m.id,
        }),
      );
    }

    if (finanzen.offeneForderungenGesamt > 0) {
      buchungen.push(
        erstelleBuchung({
          datum: startDatum,
          sollKonto: '100',
          habenKonto: '000',
          betrag: finanzen.offeneForderungenGesamt,
          buchungstext: `Eröffnungsbuchung Forderungen`,
          mitgliedId: m.id,
        }),
      );
    }
  }

  // Bestände, die zu keinem Mitglied gehören, würden beim Übertrag sonst
  // verschwinden — etwa Forderungen an inzwischen gelöschte Mitglieder.
  // Sie werden als Sammelposten übernommen und gemeldet, damit die Bilanz
  // stimmt und die fehlende Zuordnung sichtbar bleibt.
  const forderungenGesamt = salden['100'].soll - salden['100'].haben;
  const forderungenZugeordnet = mitglieder.reduce(
    (summe, m) =>
      summe + berechneMitgliedFinanzen(m.id, altesJahr.buchungen).offeneForderungenGesamt,
    0,
  );
  const forderungenRest = runde(forderungenGesamt - forderungenZugeordnet);

  if (forderungenRest > 0) {
    buchungen.push(
      erstelleBuchung({
        datum: startDatum,
        sollKonto: '100',
        habenKonto: '000',
        betrag: forderungenRest,
        buchungstext: 'Eröffnungsbuchung Forderungen; ohne Mitgliedszuordnung',
      }),
    );
    warnungen.push(
      `${forderungenRest.toFixed(2)} € an Forderungen sind keinem Mitglied zugeordnet und werden ` +
        `als Sammelposten übertragen. Ursache sind meist Buchungen zu ausgetretenen Mitgliedern.`,
    );
  }

  const restguthabenGesamt = salden['210'].haben - salden['210'].soll;
  const restguthabenZugeordnet = mitglieder.reduce(
    (summe, m) =>
      summe + Math.max(0, berechneMitgliedFinanzen(m.id, altesJahr.buchungen).restguthaben),
    0,
  );
  const restguthabenRest = runde(restguthabenGesamt - restguthabenZugeordnet);

  if (restguthabenRest > 0) {
    buchungen.push(
      erstelleBuchung({
        datum: startDatum,
        sollKonto: '000',
        habenKonto: '210',
        betrag: restguthabenRest,
        buchungstext: 'Eröffnungsbuchung Restguthaben; ohne Mitgliedszuordnung',
      }),
    );
    warnungen.push(
      `${restguthabenRest.toFixed(2)} € an Restguthaben sind keinem Mitglied zugeordnet und werden ` +
        `als Sammelposten übertragen.`,
    );
  }

  // Gegenprobe: das Eröffnungsbilanzkonto muss sich ausgleichen. Tut es
  // das nicht, wurden nicht alle Bestände übertragen.
  const neueSalden = berechneSalden(buchungen);
  const ebkSoll = neueSalden['000'].soll;
  const ebkHaben = neueSalden['000'].haben;
  const ausgeglichen = Math.abs(ebkSoll - ebkHaben) < 0.005;

  if (!ausgeglichen) {
    warnungen.push(
      `Das Eröffnungsbilanzkonto geht nicht auf (Differenz ${(ebkSoll - ebkHaben).toFixed(2)} €).`,
    );
  }

  return {
    neuesKegeljahr: {
      id: crypto.randomUUID(),
      bezeichnung: bezeichnungFuer(startDatum, endDatum),
      startDatum,
      endDatum,
      buchungen,
      kegelabende: [],
    },
    eroeffnungsbuchungen: buchungen,
    ebkSoll,
    ebkHaben,
    ausgeglichen,
    warnungen,
  };
}
