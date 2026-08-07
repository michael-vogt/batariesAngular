import { Kegeljahr, Mitglied, MitgliedStatus } from '../kegelverein.models';
import { nameSchluessel } from '../namen.util';

/**
 * Migration Schema 1 -> 2.
 *
 * In Schema 1 lag in jeder Kegeljahr-Datei eine eigene Mitgliederliste mit
 * einem einzelnen Statuswert. In Schema 2 gibt es genau eine vereinsweite
 * Liste, und der Status ist ein Verlauf.
 *
 * Zusammenführung über den Namensschlüssel, nicht über die id: dieselbe
 * Person konnte in verschiedenen Jahresdateien unterschiedliche ids haben,
 * gleiche ids wiederum können bei getrennt gepflegten Jahren kollidieren.
 * Der Name ist hier der verlässlichere Anker.
 */

interface KegeljahrV1 {
  id: string;
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
  mitglieder: { id: string; name: string; status: MitgliedStatus; rolle?: string }[];
  buchungen: Kegeljahr['buchungen'];
  kegelabende: Kegeljahr['kegelabende'];
}

export interface MigrationsErgebnis {
  kegeljahre: Kegeljahr[];
  mitglieder: Mitglied[];
  /** Zuordnung alte Mitglieds-id -> neue id, für das Umschreiben der Verweise. */
  idZuordnung: Map<string, string>;
  hinweise: string[];
}

export function istSchemaV1(json: unknown): boolean {
  return (json as { schemaVersion?: number })?.schemaVersion === 1;
}

/**
 * Führt mehrere Kegeljahr-Dateien aus Schema 1 zusammen.
 * Die Jahre müssen chronologisch aufsteigend übergeben werden, damit der
 * Statusverlauf in der richtigen Reihenfolge entsteht.
 */
export function migriereV1(jahre: KegeljahrV1[]): MigrationsErgebnis {
  const hinweise: string[] = [];
  const idZuordnung = new Map<string, string>();
  const nachSchluessel = new Map<string, Mitglied>();

  const chronologisch = [...jahre].sort((a, b) => a.startDatum.localeCompare(b.startDatum));

  for (const jahr of chronologisch) {
    for (const alt of jahr.mitglieder) {
      const schluessel = nameSchluessel(alt.name);
      const vorhanden = nachSchluessel.get(schluessel);

      if (!vorhanden) {
        // Erstes Auftauchen: Eintritt auf den Jahresbeginn datieren. Ein
        // genaueres Datum ist aus Schema 1 nicht rekonstruierbar.
        const neu: Mitglied = {
          id: alt.id,
          name: alt.name,
          statusVerlauf: [{ ab: jahr.startDatum, status: alt.status, notiz: 'aus Altdaten übernommen' }],
          ...(alt.rolle ? { rolle: alt.rolle } : {}),
        };
        nachSchluessel.set(schluessel, neu);
        idZuordnung.set(alt.id, neu.id);
        continue;
      }

      idZuordnung.set(alt.id, vorhanden.id);

      const letzter = vorhanden.statusVerlauf[vorhanden.statusVerlauf.length - 1];
      if (letzter.status !== alt.status) {
        // Statuswechsel zwischen zwei Jahren: als Änderung zum Jahresbeginn
        // festhalten. Der genaue Tag ist unbekannt, das Jahr aber sicher.
        vorhanden.statusVerlauf.push({
          ab: jahr.startDatum,
          status: alt.status,
          notiz: 'Wechsel aus Altdaten erschlossen',
        });
        hinweise.push(
          `${alt.name}: Statuswechsel ${letzter.status} → ${alt.status} zum ${jahr.startDatum} erschlossen.`,
        );
      }
      if (alt.rolle && !vorhanden.rolle) vorhanden.rolle = alt.rolle;
    }
  }

  // Verweise auf zusammengeführte Mitglieder umschreiben.
  const kegeljahre: Kegeljahr[] = chronologisch.map(jahr => ({
    id: jahr.id,
    bezeichnung: jahr.bezeichnung,
    startDatum: jahr.startDatum,
    endDatum: jahr.endDatum,
    buchungen: jahr.buchungen.map(b =>
      b.mitgliedId && idZuordnung.has(b.mitgliedId)
        ? { ...b, mitgliedId: idZuordnung.get(b.mitgliedId)! }
        : b,
    ),
    kegelabende: jahr.kegelabende.map(ka => ({
      ...ka,
      teilnehmer: ka.teilnehmer.map(t =>
        idZuordnung.has(t.id) ? { ...t, id: idZuordnung.get(t.id)! } : t,
      ),
      runden: Object.fromEntries(
        Object.entries(ka.runden).map(([spiel, runden]) => [
          spiel,
          (runden ?? []).map(r => ({
            ...r,
            ergebnisse: Object.fromEntries(
              Object.entries(r.ergebnisse).map(([id, status]) => [
                idZuordnung.get(id) ?? id,
                status,
              ]),
            ),
          })),
        ]),
      ),
    })),
  }));

  return { kegeljahre, mitglieder: [...nachSchluessel.values()], idZuordnung, hinweise };
}
