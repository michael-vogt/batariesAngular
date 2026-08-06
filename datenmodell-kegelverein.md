# Datenmodell "Kegelverein Verwaltung" — Extraktion für Angular-Reimplementierung

Quelle: `batariesWeb-main` (Vanilla-JS, PHP-Backend als simpler JSON-Blob-Store).
Die App verwaltet **Buchhaltung** (doppelte Buchführung, vereinfacht), **Mitgliederverwaltung** und **Kegelabende** (Spielprotokoll), gruppiert nach **Kegeljahr** (Geschäftsjahr Okt–Sep).

---

## 1. Top-Level-Struktur (Persistenz / Export)

Aktuelles Exportformat `version: '2.0'` (siehe `export.js`):

```ts
interface GesamtExport {
  version: '2.0';
  exportDate: string;          // ISO-Datetime
  appName: 'BatariesVerwaltungApp';
  kegeljahre: Kegeljahr[];
  currentKegeljahrId: string;
}
```

Älteres, noch unterstütztes Format `version: '1.0'` (Legacy-Migration in `import.js`) sowie das aktuell in `daten.json` liegende Format (flach, ohne Kegeljahr-Wrapper — vermutlich Übergangsformat) sollten beim Import berücksichtigt, aber **nicht** als Zielmodell übernommen werden:

```ts
// Legacy / aktuelle daten.json — NICHT als Zielstruktur verwenden, nur für Import-Kompatibilität
interface LegacyExport {
  version: string;
  exportDate: string;
  appName: string;
  kegelabende: Kegelabend[];
  buchfuehrung: { geschaeftsjahr: string; buchungen: Buchung[] };
  mitgliederverwaltung: { mitglieder: Mitglied[] };
}
```

Es gibt zusätzlich Einzel-Exporte (`exportBuchungen`, `exportMitglieder`, `exportKegelabend`), jeweils `{ version, exportDate, appName, <key>: <Daten> }`. Für Angular reicht es, den Gesamt-Export (v2.0) als kanonisches Modell zu nehmen und Teil-Importe als Merge-Operationen auf einzelne Felder zu behandeln.

---

## 2. Kegeljahr (Geschäftsjahr) — Aggregatwurzel

Alle operativen Daten hängen an einem Kegeljahr. Es ist praktisch der Aggregate Root / State-Slice pro Jahr.

```ts
interface Kegeljahr {
  id: string;                  // uid('kj')
  name?: string;                // z.B. "Kegeljahr 2025/2026" (wird an einigen Stellen erwartet)
  startDatum: Date;             // Default: 1. Oktober
  endDatum: Date;               // Default: 30. September Folgejahr
  buchungen: Buchung[];
  mitglieder: Mitglied[];
  kegelabende: Kegelabend[];
  _kegelabendCurrentId?: string | null;  // UI-State: aktuell ausgewählter Kegelabend
}
```

**Fachlogik dazu (`store.js`, `accounting.js`):**
- `findKegeljahrByDate(datum)`: findet Kegeljahr, in dessen `[startDatum, endDatum]`-Bereich ein Datum fällt.
- Neue Buchungen ohne passendes Kegeljahr erzeugen automatisch ein neues Kegeljahr (`addBuchungenToStore`).
- `kegeljahrAbschliessen()`: schließt aktuelles Jahr ab, erzeugt Eröffnungsbuchungen (Vereinsvermögen, Kasse, Restguthaben/Forderungen je Mitglied) im neuen Jahr — siehe Abschnitt 6.

**Angular-Empfehlung:** eigener `Kegeljahr`-Service/Store-Slice (z.B. NgRx-Feature oder Signal-Store) mit `currentKegeljahrId` als Selector-Basis für alle abgeleiteten Daten (Buchungen/Mitglieder/Kegelabende sind reine Projektionen des aktuellen Kegeljahrs).

---

## 3. Buchhaltung

### 3.1 Kontenrahmen (statische Stammdaten)

```ts
type KontoArt = 'Sonstige' | 'Aktivkonto' | 'Passivkonto' | 'Ertragskonto' | 'Aufwandskonto' | 'GuV';

interface Konto {
  nummer: string;   // '000'..'430', als String (führende Nullen!)
  name: string;
  art: KontoArt;
}

const KONTENRAHMEN: Konto[] = [
  { nummer: '000', name: 'Eröffnungsbilanzkonto',     art: 'Sonstige' },
  { nummer: '100', name: 'Forderungen',               art: 'Aktivkonto' },
  { nummer: '110', name: 'Kasse',                     art: 'Aktivkonto' },
  { nummer: '200', name: 'Vereinsvermögen',           art: 'Sonstige' },
  { nummer: '210', name: 'Restguthaben',              art: 'Passivkonto' },
  { nummer: '220', name: 'Schulden ggü. Dritten',     art: 'Passivkonto' },
  { nummer: '250', name: 'GuV-Konto',                 art: 'GuV' },
  { nummer: '300', name: 'Beiträge',                  art: 'Ertragskonto' },
  { nummer: '310', name: 'Strafen',                   art: 'Ertragskonto' },
  { nummer: '320', name: 'Umlagen',                   art: 'Ertragskonto' },
  { nummer: '330', name: 'Sonstige Erträge',          art: 'Ertragskonto' },
  { nummer: '400', name: 'Kegelbahn',                 art: 'Aufwandskonto' },
  { nummer: '410', name: 'Vereinsrunden',             art: 'Aufwandskonto' },
  { nummer: '420', name: 'Generalversammlung',        art: 'Aufwandskonto' },
  { nummer: '430', name: 'Sonstige Aufwendungen',     art: 'Aufwandskonto' },
];
```

### 3.2 Buchung (Journal-Eintrag)

```ts
interface Buchung {
  id: string | number;      // uid('b') oder Timestamp (Legacy-Daten haben number-IDs!)
  datum: string | Date;     // uneinheitlich: teils 'YYYY-MM-DD', teils Unix-ms-Timestamp (Legacy)
  sollKonto: string;        // Kontonummer, z.B. '100'
  habenKonto: string;
  betrag: number;
  buchungstext: string;     // Konvention: "<Vorgang>; <Mitgliedsname>" — Name wird für Zuordnung geparst!
}
```

⚠️ **Wichtige Altlast:** Die Zuordnung einer Buchung zu einem Mitglied erfolgt **nicht** über eine `mitgliedId`, sondern per Substring-Suche des Mitgliedsnamens im `buchungstext` (`isMemberMentioned`). Für die Angular-Neuimplementierung dringend empfohlen: echtes Feld `mitgliedId` einführen und Textsuche nur als Fallback/Migrationshilfe behalten.

⚠️ **Datumsfeld ist inkonsistent typisiert** (String `YYYY-MM-DD` vs. Unix-Millisekunden als Zahl vs. `Date`-Objekt je nach Erzeugungsweg). Für Angular: beim Import konsequent auf `Date` bzw. ISO-String normalisieren.

### 3.3 Saldenberechnung

```ts
interface KontoSaldo { soll: number; haben: number; }
type Salden = Record<string /* Kontonummer */, KontoSaldo>;
```

Logik `berechneSalden(buchungen)`:
1. Für jede Buchung: `salden[sollKonto].soll += betrag`, `salden[habenKonto].haben += betrag`.
2. GuV-Konto (`250`) wird abgeleitet: Summe der Haben-Salden aller Ertragskonten → `guvHaben`; Summe der Soll-Salden aller Aufwandskonten → `guvSoll`.
3. GuV-Saldo (`guvSoll - guvHaben`) wird auf Vereinsvermögen (`200`) verbucht (Gewinn erhöht Haben, Verlust erhöht Soll).

### 3.4 Mitglieds-Finanzen (abgeleiteter Wert, nicht persistiert)

```ts
interface MemberFinance {
  forderungenMonatsbeitrag: number;
  forderungenStrafen: number;
  forderungenUmlagen: number;
  forderungen: number;      // Summe der drei obigen
  restguthaben: number;
}
```

Wird **pro Mitglied on-the-fly** aus allen Buchungen berechnet (`calcFinanzenForMember`), nicht gespeichert. Regeln (Konten wie oben):
- Soll `100` / Haben `300` → Beitragsforderung +
- Soll `100` / Haben `310` oder `000` → Strafenforderung +
- Soll `100` / Haben `320` → Umlagenforderung +
- Soll `210` / Haben `110` → Restguthaben − (Verrechnung)
- Soll `110` / Haben `100`, Text enthält "Beitrag"/"Strafen" → jeweilige Forderung −, sonst: Tilgung erst Beitrag, dann Strafen, dann Umlagen (Restbetrag-Kaskade)
- Haben `210` (beliebiges Soll) → Restguthaben +

Zusätzlich abgeleitete Tabellenzeile für die Mitgliederübersicht/PDF-Export (`erzeugeMitgliederDaten`):

```ts
interface MitgliedUebersichtZeile {
  name: string;
  status: 'aktiv' | 'passiv';
  beitraege: number;
  strafen: number;
  umlagen: number;
  verrechnungBeitrag: number;
  verrechnungStrafen: number;
  verrechnungUmlagen: number;
  verrechnungGesamt: number;
  saldo: number;                    // offene Forderung nach Verrechnung
  restguthaben: number;
  verbleibendesRestguthaben: number;
}
```

### 3.5 Journal-Vorgänge (Buchungssatz-Generatoren)

Reine Funktionen, die aus fachlichem Input Buchungssätze erzeugen (kein State-Zugriff):

| Funktion | Zweck | Erzeugte Buchungssätze |
|---|---|---|
| `journalMonatsbeitraege({datum, mitglieder, beitragAktiv=8, beitragPassiv=1})` | Monatsbeitrag je Mitglied | je 1x Soll `100` / Haben `300` |
| `journalStrafen({datum, posten:[{name,betrag}]})` | Strafen aus Kegelabend übernehmen | je 1x Soll `100` / Haben `310` |
| `journalRestguthabenVerrechnung({datum, mitglieder, buchungen})` | Restguthaben mit offenen Forderungen verrechnen (Beitrag→Strafen→Umlagen-Kaskade) | bis zu 2 Buchungen je Forderungsart (Soll `210`/Haben `110`, dann Soll `110`/Haben `100`) |
| `journalEinnahmen({datum, mitglieder, betraegeProMitglied, buchungen})` | Zahlungseingang verbuchen; zuerst Forderungen tilgen, Rest als Überzahlung ins Restguthaben | Soll `110`/Haben `100` und/oder Soll `110`/Haben `210` |
| `journalGeburtstagsumlage({datum, ausrichter, gaeste})` | Umlage für Geburtstagsrunde (10€ pro Gast + Zusatzpersonen) | je Gast Soll `100`/Haben `320`; Summe Soll `320`/Haben `210` an Ausrichter |

`validateBuchung()` / `createBuchung()` sind generische Helper (Pflichtfeld-Check, Soll≠Haben-Check, ID-Vergabe).

### 3.6 Jahresabschluss (`kegeljahrAbschliessen`)

Erzeugt im **neuen** Kegeljahr Eröffnungsbuchungen aus den Salden des alten Jahres:
- Vereinsvermögen: Soll `000` / Haben `200`
- Kasse: Soll `110` / Haben `000`
- je Mitglied mit Restguthaben > 0: Soll `000` / Haben `210`
- je Mitglied mit Forderung > 0: Soll `100` / Haben `000`

Danach Prüfung, dass Eröffnungsbilanzkonto (`000`) ausgeglichen ist.

---

## 4. Mitgliederverwaltung

```ts
interface Mitglied {
  id: string;                 // uid('m')
  name: string;
  status: 'aktiv' | 'passiv';
  role?: string;               // z.B. 'P' (Präsident), 'zbV', 'K & S' (Kasse & Schriftführer) — informell, freier Text
  // In daten.json (Export) zusätzlich vorhanden, aber im aktuellen Code ungenutzt/immer 0:
  forderungen?: number;
  restguthaben?: number;
}
```

Hinweis: `forderungen`/`restguthaben` werden im Export mitgeschrieben, aber laut Code stets live berechnet (Abschnitt 3.4) — im Mitglied-Objekt sind sie **redundant/veraltet**. Für Angular: nicht persistieren, sondern als Selector/Computed ableiten.

---

## 5. Kegelabend (Spielprotokoll eines Abends)

### 5.1 Kegelabend

```ts
interface Kegelabend {
  id: string;
  datum: string;               // 'YYYY-MM-DD'
  ort: string | null;
  players: KegelabendSpieler[];
  rounds: Record<GameKey, Runde[]>;   // pro Spiel eine Liste von Runden
  summary: { rows: KegelabendSummaryRow[] };
}

interface KegelabendSpieler {
  name: string;
  role: string;                // '', 'P', 'zbV', 'K & S' ... (Kopie aus Mitgliedsstamm zum Zeitpunkt)
  isGuest: boolean;
  present: boolean;
  stats: {
    verspaetung: number;       // Stunden zu spät
    pumpen: number;            // Anzahl "Pumpen"
    neuner: number;
    eingeholt: number;
    schnaps: number;
  };
}

type GameKey =
  | 'abraeumen' | 'christbaum' | 'fuchsjagd' | 'hohe' | 'koenig'
  | 'niedrige' | 'regenundsonne' | 'siebzehn' | 'totenkiste' | 'viergewinnt';

type SpielStatus = 'participated' | 'winner' | 'loser' | 'not_participated';

interface Runde {
  id: string;
  played?: boolean;
  states: SpielStatus[];       // 1 Eintrag pro players[i], per Index korreliert (kein Objektbezug!)
  notes: string;
}
```

⚠️ `states[i]` korrespondiert per **Array-Index** mit `players[i]` — kein `playerId`-Bezug. Beim Hinzufügen eines Gastes wird an jede bestehende Runde ein weiteres `"not_participated"` angehängt. Für Angular dringend empfohlen: `states` als `Record<playerId, SpielStatus>` oder zumindest `{ playerId, status }[]` statt positionsabhängigem Array.

### 5.2 Strafen-Konstanten (Spielabend)

```ts
const PENALTY = {
  versp: 1.00,                 // € pro Stunde Verspätung (immer, unabhängig von Anwesenheit)
  pumpe: 0.10,                 // € pro Pumpe (nur wenn present)
  teilnahme: 0.10,              // € für "participated" (normalfall, weder Sieg noch Niederlage)
  lose_default: 0.25,           // € Niederlage in normalen Spielen
  lose_fuchs_totenkiste: 0.50,  // € Niederlage bei 'fuchsjagd' / 'totenkiste'
};
```

Sonderregeln in `computeSummary`:
- `fuchsjagd`, Status `participated`, falls es Gewinner in der Runde gibt: +0.25 € (statt Standard-Teilnahmestrafe)
- `totenkiste`, Status `participated`: keine Strafe
- ansonsten `participated`: Standard-Teilnahmestrafe (0.10 €)

### 5.3 Abgeleitete Zusammenfassung (nicht persistente Quelle der Wahrheit, wird aber in `summary` gecacht)

```ts
interface KegelabendSummaryRow {
  name: string;
  anwesend: boolean;
  siege: number;
  niederlagen: number;
  bilanz: number;               // siege - niederlagen
  verspaetung: number;
  pumpen: number;
  neuner: number;
  eingeholt: number;
  schnaps: number;
  strafe: number;                // Gesamtstrafe in €, aus Runden + Verspätung + Pumpen
}
```

`computeSummary(ka)` iteriert alle Spiele/Runden, aggregiert Siege/Niederlagen und Strafen je Spieler, addiert danach `verspaetung * PENALTY.versp` und (nur wenn anwesend) `pumpen * PENALTY.pumpe`.

Die daraus resultierenden Strafbeträge werden anschließend über `journalStrafen()` (Abschnitt 3.5) in die Buchhaltung übernommen (Soll `100` Forderungen / Haben `310` Strafen).

---

## 6. Ereignis-/Update-Mechanismus (nur für Kontext, kein Datenmodell)

Die Legacy-App nutzt ein simples Event-Bus-Pattern (`EVENTS.updateUIBuchung`, `updateUIMitgliedRender`, `updateUIKegelabend`, `updateUIMitgliedUpdate`) um UI-Renderer nach Store-Mutationen zu benachrichtigen. In Angular entfällt das durch reaktiven State (Signals/RxJS/NgRx) — die Trigger-Punkte markieren aber, **wann** abgeleitete Daten (Salden, Mitglieds-Finanzen, Kegelabend-Summary) neu berechnet werden müssen:
- nach jeder Buchungs-Mutation (add/update/delete/reset/import)
- nach jeder Mitglieder-Mutation
- nach jeder Kegelabend-Mutation
- nach Kegeljahr-Wechsel

---

## 7. Empfehlungen für die Angular-Neuimplementierung

1. **`mitgliedId` statt Namens-Matching** in `Buchung` und in `Runde.states` einführen (größte strukturelle Schwäche der Legacy-App).
2. **Datum konsequent als `Date`/ISO-String** typisieren; Legacy-Daten (Unix-ms, gemischte Typen) nur beim Import normalisieren.
3. **Abgeleitete Werte (Salden, MemberFinance, KegelabendSummary) nicht persistieren**, sondern als NgRx-Selectors / Angular Signals `computed()` aus den Rohdaten (Buchungen, Mitglieder, Runden) ableiten — Legacy tut dies teils schon (MemberFinance), teils nicht (`summary` im Kegelabend wird gecacht).
4. **Kontenrahmen als konstantes, typisiertes Enum/Lookup** übernehmen (Abschnitt 3.1) — Kontonummern als `string`-Literal-Union möglich, um Tippfehler zu vermeiden.
5. **Kegeljahr als Feature-State-Slice**, alle anderen Domänen (Buchungen, Mitglieder, Kegelabende) als Kind-Collections darin — passt gut zu einem NgRx-Feature-Store mit `currentKegeljahrId` als Root-Selector.
6. Import-Kompatibilität: Falls Altbestände (v1.0-Export oder die flache `daten.json`-Struktur) übernommen werden sollen, einen einmaligen Migrations-/Mapper-Service einplanen, der auf das neue Zielmodell (inkl. `mitgliedId`-Auflösung per Namensabgleich) transformiert.

---

## 8. Zusätzliche Original-Dateien (falls Detailfragen aufkommen)

Für Rückfragen zur exakten Legacy-Logik sind folgende Dateien im Archiv besonders relevant:
- `js/data/store.js` — State-Container
- `js/core/accounting.js` — Kontenrahmen, Salden, Jahresabschluss
- `js/core/member-finance.js` — Forderungs-/Restguthaben-Berechnung je Mitglied
- `js/services/journal-service.js` — Buchungssatz-Generatoren
- `js/services/kegelabend-service.js` — Kegelabend-Domänenlogik
- `js/controllers/*.js` — UI-Verdrahtung (DOM-lastig, für Angular nicht 1:1 übernehmbar, aber zeigt Use Cases)
