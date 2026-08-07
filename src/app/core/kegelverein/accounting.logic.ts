import { Buchung, KONTENRAHMEN, Mitglied, MitgliedFinanzen, Salden } from './kegelverein.models';

/**
 * Reine Funktionen ohne Store-/DOM-Zugriff — direkt unit-testbar.
 * Die Angular-Services (siehe kegelverein.services.ts) sind nur dünne
 * Wrapper, die diese Funktionen mit dem aktuellen State verdrahten.
 */

function rund(n: number): number {
  return Math.abs(n) < 1e-10 ? 0 : Math.round(n * 100) / 100;
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

// =====================================================================
// Salden
// =====================================================================

export function berechneSalden(buchungen: Buchung[]): Salden {
  const salden = {} as Salden;
  for (const konto of KONTENRAHMEN) {
    salden[konto.nummer] = { soll: 0, haben: 0 };
  }

  for (const b of buchungen) {
    salden[b.sollKonto].soll += b.betrag;
    salden[b.habenKonto].haben += b.betrag;
  }

  // GuV aus Ertrags-/Aufwandskonten ableiten
  let guvSoll = 0;
  let guvHaben = 0;
  for (const konto of KONTENRAHMEN) {
    const { soll, haben } = salden[konto.nummer];
    const saldo = soll - haben;
    if (konto.art === 'Ertrag' && saldo < 0) guvHaben += Math.abs(saldo);
    if (konto.art === 'Aufwand' && saldo > 0) guvSoll += saldo;
  }
  salden['250'] = { soll: guvSoll, haben: guvHaben };

  // GuV-Saldo auf Vereinsvermögen (200) übertragen
  const guvSaldo = guvSoll - guvHaben;
  if (guvSaldo > 0)
    salden['200'].soll += guvSaldo; // Verlust
  else if (guvSaldo < 0) salden['200'].haben += Math.abs(guvSaldo); // Gewinn

  return salden;
}

// =====================================================================
// Mitgliedsfinanzen (Forderungen/Restguthaben je Mitglied)
// =====================================================================

export function berechneMitgliedFinanzen(
  mitgliedId: string,
  buchungen: Buchung[],
): MitgliedFinanzen {
  let offeneBeitraege = 0;
  let offeneStrafen = 0;
  let offeneUmlagen = 0;
  let restguthaben = 0;

  for (const b of buchungen) {
    if (b.mitgliedId !== mitgliedId) continue;

    if (b.sollKonto === '100') {
      if (b.habenKonto === '300') offeneBeitraege += b.betrag;
      else if (b.habenKonto === '310' || b.habenKonto === '000') offeneStrafen += b.betrag;
      else if (b.habenKonto === '320') offeneUmlagen += b.betrag;
    } else if (b.sollKonto === '210' && b.habenKonto === '110') {
      restguthaben -= b.betrag; // Verrechnung Restguthaben -> Kasse
    } else if (b.sollKonto === '110' && b.habenKonto === '100') {
      // Zahlung tilgt zunächst Beiträge, dann Strafen, dann Umlagen
      let rest = b.betrag;
      const t1 = Math.min(offeneBeitraege, rest);
      offeneBeitraege -= t1;
      rest -= t1;

      const t2 = Math.min(offeneStrafen, rest);
      offeneStrafen -= t2;
      rest -= t2;

      offeneUmlagen -= Math.min(offeneUmlagen, rest);
    }

    if (b.habenKonto === '210') restguthaben += b.betrag;
  }

  offeneBeitraege = rund(offeneBeitraege);
  offeneStrafen = rund(offeneStrafen);
  offeneUmlagen = rund(offeneUmlagen);
  restguthaben = rund(restguthaben);

  return {
    mitgliedId,
    offeneBeitraege,
    offeneStrafen,
    offeneUmlagen,
    offeneForderungenGesamt: rund(offeneBeitraege + offeneStrafen + offeneUmlagen),
    restguthaben,
  };
}

// =====================================================================
// Buchungssatz-Generatoren (Geschäftsvorfälle -> Buchung[])
// =====================================================================

export function erstelleBuchung(input: Omit<Buchung, 'id'>): Buchung {
  return { id: uid('b'), ...input };
}

/**
 * Monatsbeiträge für Vereinsmitglieder. Gastkegler bleiben außen vor —
 * sie zahlen keinen Beitrag, sondern nur ihre Strafen aus den Spielabenden.
 */
export function journalMonatsbeitraege(params: {
  datum: string;
  mitglieder: Mitglied[];
  beitragAktiv?: number;
  beitragPassiv?: number;
}): Buchung[] {
  const { datum, mitglieder, beitragAktiv = 8, beitragPassiv = 1 } = params;
  return mitglieder
    .filter((m) => m.status !== 'gastkegler')
    .map((m) =>
      erstelleBuchung({
        datum,
        sollKonto: '100',
        habenKonto: '300',
        betrag: m.status === 'aktiv' ? beitragAktiv : beitragPassiv,
        buchungstext: `Monatsbeitrag; ${m.name}`,
        mitgliedId: m.id,
      }),
    );
}

export function journalStrafen(params: {
  datum: string;
  posten: { mitglied: Mitglied; betrag: number }[];
}): Buchung[] {
  return params.posten
    .filter((p) => p.betrag > 0)
    .map((p) =>
      erstelleBuchung({
        datum: params.datum,
        sollKonto: '100',
        habenKonto: '310',
        betrag: p.betrag,
        buchungstext: `Strafen Kegeln; ${p.mitglied.name}`,
        mitgliedId: p.mitglied.id,
      }),
    );
}

export function journalRestguthabenVerrechnung(params: {
  datum: string;
  mitglieder: Mitglied[];
  buchungen: Buchung[];
}): Buchung[] {
  const out: Buchung[] = [];

  for (const m of params.mitglieder) {
    const f = berechneMitgliedFinanzen(m.id, params.buchungen);

    const betragBeitrag = Math.min(f.offeneBeitraege, f.restguthaben);
    const betragStrafen = Math.min(f.offeneStrafen, Math.max(0, f.restguthaben - betragBeitrag));
    const betragUmlagen = Math.min(
      f.offeneUmlagen,
      Math.max(0, f.restguthaben - betragBeitrag - betragStrafen),
    );

    const verrechne = (betrag: number, text: string) => {
      if (betrag <= 0) return;
      out.push(
        erstelleBuchung({
          datum: params.datum,
          sollKonto: '210',
          habenKonto: '110',
          betrag,
          buchungstext: text,
          mitgliedId: m.id,
        }),
      );
      out.push(
        erstelleBuchung({
          datum: params.datum,
          sollKonto: '110',
          habenKonto: '100',
          betrag,
          buchungstext: text,
          mitgliedId: m.id,
        }),
      );
    };

    verrechne(betragBeitrag, `Verrechnung Restguthaben für Beitrag; ${m.name}`);
    verrechne(betragStrafen, `Verrechnung Restguthaben für Strafen; ${m.name}`);
    verrechne(betragUmlagen, `Verrechnung Restguthaben für Umlagen; ${m.name}`);
  }

  return out;
}

export function journalEinnahmen(params: {
  datum: string;
  zahlungen: { mitglied: Mitglied; betrag: number }[];
  buchungen: Buchung[];
}): Buchung[] {
  const out: Buchung[] = [];

  for (const { mitglied, betrag: brutto } of params.zahlungen) {
    if (brutto <= 0) continue;

    const f = berechneMitgliedFinanzen(mitglied.id, params.buchungen);
    const fuerForderungen = Math.min(brutto, f.offeneForderungenGesamt);
    const fuerRestguthaben = Math.max(0, brutto - fuerForderungen);

    if (fuerForderungen > 0) {
      out.push(
        erstelleBuchung({
          datum: params.datum,
          sollKonto: '110',
          habenKonto: '100',
          betrag: fuerForderungen,
          buchungstext: `Einnahmen; ${mitglied.name}`,
          mitgliedId: mitglied.id,
        }),
      );
    }
    if (fuerRestguthaben > 0) {
      out.push(
        erstelleBuchung({
          datum: params.datum,
          sollKonto: '110',
          habenKonto: '210',
          betrag: fuerRestguthaben,
          buchungstext: `Überzahlung; ${mitglied.name}`,
          mitgliedId: mitglied.id,
        }),
      );
    }
  }

  return out;
}

export function journalGeburtstagsumlage(params: {
  datum: string;
  ausrichter: Mitglied;
  gaeste: { mitglied: Mitglied; anzahlZusatzpersonen: number }[];
}): Buchung[] {
  const out: Buchung[] = [];
  let summe = 0;

  for (const g of params.gaeste) {
    const betrag = 10 * (g.anzahlZusatzpersonen + 1);
    summe += betrag;
    out.push(
      erstelleBuchung({
        datum: params.datum,
        sollKonto: '100',
        habenKonto: '320',
        betrag,
        buchungstext: `Geburtstagsumlage; ${g.mitglied.name}`,
        mitgliedId: g.mitglied.id,
      }),
    );
  }

  out.push(
    erstelleBuchung({
      datum: params.datum,
      sollKonto: '320',
      habenKonto: '210',
      betrag: summe,
      buchungstext: `Geburtstagsgeschenk; ${params.ausrichter.name}`,
      mitgliedId: params.ausrichter.id,
    }),
  );

  return out;
}
