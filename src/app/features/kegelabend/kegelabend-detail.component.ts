import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { KegelabendService } from '../../core/kegelverein/kegelabend.service';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { findeNamensdublette } from '../../core/kegelverein/namen.util';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import {
  Kegelabend,
  KegelabendTeilnehmer,
  Mitglied,
  SPIELE,
  SpielKey,
  SpielRunde,
  SpielStatus,
} from '../../core/kegelverein/kegelverein.models';

/** Frischer Teilnehmereintrag aus einem Mitglied; Statistiken starten bei null. */
function neuerTeilnehmer(m: Mitglied): KegelabendTeilnehmer {
  return {
    id: m.id,
    name: m.name,
    anwesend: true,
    verspaetungStunden: 0,
    pumpen: 0,
    neuner: 0,
    eingeholt: 0,
    schnaps: 0,
  };
}

/** Reihenfolge beim Durchklicken einer Zelle im Rundenraster. */
const STATUS_FOLGE: SpielStatus[] = ['nicht_teilgenommen', 'teilgenommen', 'gewonnen', 'verloren'];

const STATUS_KURZ: Record<SpielStatus, string> = {
  nicht_teilgenommen: '·',
  teilgenommen: '○',
  gewonnen: 'S',
  verloren: 'N',
};

const STATUS_TITEL: Record<SpielStatus, string> = {
  nicht_teilgenommen: 'nicht teilgenommen',
  teilgenommen: 'teilgenommen',
  gewonnen: 'gewonnen',
  verloren: 'verloren',
};

@Component({
  selector: 'app-kegelabend-detail',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="seite">
      @if (!abend()) {
        <p class="fehler">
          Kegelabend nicht gefunden. <a routerLink="/kegelabende">Zur Übersicht</a>
        </p>
      } @else {
        <header class="seiten-kopf">
          <div>
            <a routerLink="/kegelabende" class="zurueck">← Alle Kegelabende</a>
            <h1>{{ datumLang(abend()!.datum) }}</h1>
            @if (abend()!.ort) {
              <p class="hinweis">{{ abend()!.ort }}</p>
            }
          </div>
          <div class="kopf-aktionen">
            @if (daten.ungespeichert()) {
              <span class="hinweis">Nicht gespeicherte Änderungen</span>
            }
            <button
              type="button"
              class="primaer"
              [disabled]="!daten.ungespeichert() || speichert()"
              (click)="speichern()"
            >
              {{ speichert() ? 'Speichert…' : 'Änderungen speichern' }}
            </button>
          </div>
        </header>

        @if (daten.fehler(); as text) {
          <p class="fehler">{{ text }}</p>
        }

        <!-- Teilnehmer und Einzelstrafen -->
        <section class="karte">
          <h2>Teilnehmer</h2>
          <table class="daten">
            <thead>
              <tr>
                <th>Name</th>
                <th>Anwesend</th>
                <th class="zahl">Verspätung (h)</th>
                <th class="zahl">Pumpen</th>
                <th class="zahl">Neuner</th>
                <th class="zahl">Eingeholt</th>
                <th class="zahl">Schnaps</th>
                <th><span class="visuell-versteckt">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              @for (t of abend()!.teilnehmer; track t.id) {
                <tr [class.abwesend]="!t.anwesend">
                  <td>
                    {{ t.name }}
                    @if (istGast(t.id)) {
                      <span class="marke">Gastkegler</span>
                    }
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="t.anwesend"
                      (change)="anwesenheitGeaendert(t, $event)"
                      [attr.aria-label]="t.name + ' anwesend'"
                    />
                  </td>
                  <td class="zahl">
                    <input
                      class="zahl-feld"
                      type="number"
                      min="0"
                      step="0.5"
                      [ngModel]="t.verspaetungStunden"
                      (ngModelChange)="statistikGeaendert(t, 'verspaetungStunden', $event)"
                    />
                  </td>
                  <td class="zahl">
                    <input
                      class="zahl-feld"
                      type="number"
                      min="0"
                      [ngModel]="t.pumpen"
                      (ngModelChange)="statistikGeaendert(t, 'pumpen', $event)"
                    />
                  </td>
                  <td class="zahl">
                    <input
                      class="zahl-feld"
                      type="number"
                      min="0"
                      [ngModel]="t.neuner"
                      (ngModelChange)="statistikGeaendert(t, 'neuner', $event)"
                    />
                  </td>
                  <td class="zahl">
                    <input
                      class="zahl-feld"
                      type="number"
                      min="0"
                      [ngModel]="t.eingeholt"
                      (ngModelChange)="statistikGeaendert(t, 'eingeholt', $event)"
                    />
                  </td>
                  <td class="zahl">
                    <input
                      class="zahl-feld"
                      type="number"
                      min="0"
                      [ngModel]="t.schnaps"
                      (ngModelChange)="statistikGeaendert(t, 'schnaps', $event)"
                    />
                  </td>
                  <td>
                    <button type="button" class="leise-aktion" (click)="teilnehmerEntfernen(t)">
                      Entfernen
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="hinzufuegen">
            @if (verfuegbare().length > 0) {
              <div class="formular-zeile">
                <label>
                  Mitglied hinzufügen
                  <select [ngModel]="auswahlId()" (ngModelChange)="auswahlId.set($event)">
                    <option value="">– auswählen –</option>
                    @for (m of verfuegbare(); track m.id) {
                      <option [value]="m.id">
                        {{ m.name }}{{ m.status === 'gastkegler' ? ' (Gastkegler)' : '' }}
                      </option>
                    }
                  </select>
                </label>
                <button type="button" [disabled]="!auswahlId()" (click)="teilnehmerHinzufuegen()">
                  Hinzufügen
                </button>
              </div>
            }

            <div class="formular-zeile">
              <label>
                Neuer Gastkegler
                <input
                  type="text"
                  placeholder="Name"
                  [ngModel]="gastName()"
                  (ngModelChange)="gastName.set($event)"
                  (keyup.enter)="gastAnlegen()"
                />
              </label>
              <button type="button" [disabled]="!gastName().trim()" (click)="gastAnlegen()">
                Anlegen und hinzufügen
              </button>
            </div>
            @if (gastFehler(); as text) {
              <p class="fehler">{{ text }}</p>
            }
            <p class="hinweis">
              Gastkegler werden als Mitglied mit dem Status „Gastkegler“ geführt. Sie zahlen keinen
              Monatsbeitrag, ihre Strafen werden aber wie bei allen anderen verbucht.
            </p>
          </div>
        </section>

        <!-- Spielrunden -->
        <section class="karte spiele">
          <h2>Spiele</h2>

          <nav class="spiel-tabs" role="tablist">
            @for (spiel of spiele; track spiel.key) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="spiel.key === aktivesSpiel()"
                [class.aktiv]="spiel.key === aktivesSpiel()"
                (click)="aktivesSpiel.set(spiel.key)"
              >
                {{ spiel.name }}
                @if (rundenAnzahl(spiel.key) > 0) {
                  <span class="anzahl">{{ rundenAnzahl(spiel.key) }}</span>
                }
              </button>
            }
          </nav>

          @if (runden().length === 0) {
            <p class="hinweis">
              Noch keine Runde für {{ aktivesSpielName() }}. Runde hinzufügen, um zu beginnen.
            </p>
          } @else {
            <div class="raster-umschlag">
              <table class="daten raster">
                <thead>
                  <tr>
                    <th>Spieler</th>
                    @for (r of runden(); track r.id; let i = $index) {
                      <th class="zahl">{{ i + 1 }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (t of abend()!.teilnehmer; track t.id) {
                    <tr [class.abwesend]="!t.anwesend">
                      <td>{{ t.name }}</td>
                      @for (r of runden(); track r.id) {
                        <td class="zahl">
                          <button
                            type="button"
                            class="status"
                            [attr.data-status]="statusVon(r, t.id)"
                            [title]="t.name + ': ' + statusTitel(statusVon(r, t.id))"
                            (click)="statusWeiter(r, t.id)"
                          >
                            {{ statusKurz(statusVon(r, t.id)) }}
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="hinweis legende">
              Zelle anklicken zum Wechseln: · nicht dabei → ○ mitgespielt → S Sieg → N Niederlage
            </p>
          }

          <div class="runden-aktionen">
            <button type="button" (click)="rundeHinzufuegen()">
              Runde für {{ aktivesSpielName() }} hinzufügen
            </button>
            @if (runden().length > 0) {
              <button type="button" class="leise-aktion" (click)="letzteRundeEntfernen()">
                Letzte Runde entfernen
              </button>
            }
          </div>
        </section>

        <!-- Auswertung -->
        <section class="karte">
          <h2>Auswertung</h2>
          <table class="daten">
            <thead>
              <tr>
                <th>Name</th>
                <th class="zahl">Siege</th>
                <th class="zahl">Niederlagen</th>
                <th class="zahl">Bilanz</th>
                <th class="zahl">Strafe</th>
              </tr>
            </thead>
            <tbody>
              @for (zeile of auswertung(); track zeile.teilnehmerId) {
                <tr>
                  <td>
                    {{ nameVon(zeile.teilnehmerId) }}
                    @if (istGast(zeile.teilnehmerId)) {
                      <span class="marke">Gastkegler</span>
                    }
                  </td>
                  <td class="zahl">{{ zeile.siege }}</td>
                  <td class="zahl">{{ zeile.niederlagen }}</td>
                  <td class="zahl">{{ zeile.bilanz > 0 ? '+' : '' }}{{ zeile.bilanz }}</td>
                  <td class="zahl" [class.betrag-offen]="zeile.strafeGesamt > 0">
                    {{ euro(zeile.strafeGesamt) }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"><strong>Summe</strong></td>
                <td class="zahl">
                  <strong>{{ euro(strafenSumme()) }}</strong>
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="uebernahme">
            <button type="button" [disabled]="strafenSumme() === 0" (click)="strafenUebernehmen()">
              Strafen in die Buchführung übernehmen
            </button>
            <p class="hinweis">
              Erzeugt je Teilnehmer eine Buchung (Forderungen an Strafen), auch für Gastkegler.
              Mehrfaches Übernehmen bucht erneut — nur einmal pro Abend ausführen.
            </p>
            @if (uebernahmeMeldung(); as text) {
              <p class="ok">{{ text }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .zurueck {
      font-size: 0.875rem;
      color: var(--farbe-text-leise);
      text-decoration: none;
    }
    .zurueck:hover {
      color: var(--farbe-akzent);
    }
    .seiten-kopf h1 {
      margin: var(--abstand-1) 0 0;
    }
    .seiten-kopf .hinweis {
      margin: var(--abstand-1) 0 0;
    }
    .kopf-aktionen {
      display: flex;
      align-items: center;
      gap: var(--abstand-3);
    }

    .karte {
      margin-bottom: var(--abstand-6);
    }
    .karte h2 {
      margin: 0 0 var(--abstand-3);
      font-size: 1.0625rem;
      font-weight: 600;
    }

    tr.abwesend td {
      opacity: 0.45;
    }
    .marke {
      margin-left: var(--abstand-2);
      padding: 0 var(--abstand-2);
      border-radius: 999px;
      background: var(--farbe-akzent-hell);
      color: var(--farbe-akzent);
      font-size: 0.75rem;
    }
    .zahl-feld {
      width: 4.5rem;
      text-align: right;
      font-family: var(--schrift-zahl);
    }

    .formular-zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--abstand-3);
    }
    .formular-zeile label {
      display: flex;
      flex-direction: column;
      gap: var(--abstand-1);
      font-size: 0.8125rem;
      color: var(--farbe-text-leise);
    }
    .hinzufuegen {
      margin-top: var(--abstand-4);
      display: grid;
      gap: var(--abstand-3);
    }
    .hinzufuegen .hinweis {
      margin: 0;
      max-width: 46rem;
    }

    .spiel-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--abstand-2);
      margin-bottom: var(--abstand-4);
    }
    .spiel-tabs button {
      font-size: 0.875rem;
    }
    .spiel-tabs button.aktiv {
      background: var(--farbe-akzent-hell);
      border-color: var(--farbe-akzent);
      color: var(--farbe-akzent);
      font-weight: 600;
    }
    .spiel-tabs .anzahl {
      margin-left: var(--abstand-1);
      font-family: var(--schrift-zahl);
      font-size: 0.75rem;
      opacity: 0.7;
    }

    /* Bei vielen Runden horizontal scrollen statt die Tabelle zu quetschen */
    .raster-umschlag {
      overflow-x: auto;
    }
    .raster th,
    .raster td {
      white-space: nowrap;
    }

    button.status {
      width: 2rem;
      padding: var(--abstand-1) 0;
      font-family: var(--schrift-zahl);
      font-size: 0.875rem;
      border-color: transparent;
      background: transparent;
    }
    button.status[data-status='nicht_teilgenommen'] {
      color: var(--farbe-text-leise);
      opacity: 0.5;
    }
    button.status[data-status='teilgenommen'] {
      color: var(--farbe-text);
    }
    button.status[data-status='gewonnen'] {
      background: var(--farbe-akzent-hell);
      color: var(--farbe-haben);
      font-weight: 700;
    }
    button.status[data-status='verloren'] {
      color: var(--farbe-soll);
      font-weight: 700;
    }

    .legende {
      margin: var(--abstand-3) 0 0;
      font-size: 0.8125rem;
    }
    .runden-aktionen {
      display: flex;
      flex-wrap: wrap;
      gap: var(--abstand-3);
      margin-top: var(--abstand-4);
    }
    .uebernahme {
      margin-top: var(--abstand-4);
    }
    .uebernahme .hinweis {
      margin: var(--abstand-2) 0 0;
      max-width: 46rem;
    }

    .visuell-versteckt {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class KegelabendDetailComponent {
  /** Kommt aus der Route (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly kegelabendService = inject(KegelabendService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly spiele = SPIELE;
  protected readonly aktivesSpiel = signal<SpielKey>(SPIELE[0].key);
  protected readonly gastName = signal('');
  protected readonly gastFehler = signal<string | null>(null);
  protected readonly auswahlId = signal('');
  protected readonly speichert = signal(false);
  protected readonly uebernahmeMeldung = signal<string | null>(null);

  protected readonly abend = computed(() =>
    this.kegelabendService.kegelabende().find((ka) => ka.id === this.id()),
  );

  protected readonly runden = computed(() => this.abend()?.runden[this.aktivesSpiel()] ?? []);

  /** Mitglieder, die an diesem Abend noch nicht eingetragen sind. */
  protected readonly verfuegbare = computed(() => {
    const vorhanden = new Set(this.abend()?.teilnehmer.map((t) => t.id) ?? []);
    return this.mitgliederService.mitglieder().filter((m) => !vorhanden.has(m.id));
  });

  protected readonly auswertung = computed(() => {
    const ka = this.abend();
    return ka ? this.kegelabendService.ergebnisse(ka) : [];
  });

  protected readonly strafenSumme = computed(() =>
    this.auswertung().reduce((s, z) => s + z.strafeGesamt, 0),
  );

  protected aktivesSpielName(): string {
    return SPIELE.find((s) => s.key === this.aktivesSpiel())!.name;
  }

  protected rundenAnzahl(key: SpielKey): number {
    return this.abend()?.runden[key]?.length ?? 0;
  }

  protected statusVon(runde: SpielRunde, teilnehmerId: string): SpielStatus {
    return runde.ergebnisse[teilnehmerId] ?? 'nicht_teilgenommen';
  }

  protected statusKurz(status: SpielStatus): string {
    return STATUS_KURZ[status];
  }

  protected statusTitel(status: SpielStatus): string {
    return STATUS_TITEL[status];
  }

  protected nameVon(teilnehmerId: string): string {
    return this.abend()?.teilnehmer.find((t) => t.id === teilnehmerId)?.name ?? '—';
  }

  protected istGast(teilnehmerId: string): boolean {
    return (
      this.mitgliederService.mitglieder().find((m) => m.id === teilnehmerId)?.status ===
      'gastkegler'
    );
  }

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected datumLang(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  // --- Änderungen ------------------------------------------------------
  // Durchgehend unveränderlich: jede Änderung erzeugt neue Objekte, damit
  // die computed()-Ketten zuverlässig neu rechnen.

  private aendern(fn: (ka: Kegelabend) => Kegelabend): void {
    const ka = this.abend();
    if (!ka) return;
    this.kegelabendService.speichern(fn(ka));
    this.daten.aenderungVorgemerkt();
  }

  protected anwesenheitGeaendert(t: KegelabendTeilnehmer, event: Event): void {
    const anwesend = (event.target as HTMLInputElement).checked;
    this.aendern((ka) => ({
      ...ka,
      teilnehmer: ka.teilnehmer.map((x) => (x.id === t.id ? { ...x, anwesend } : x)),
    }));
  }

  protected statistikGeaendert(
    t: KegelabendTeilnehmer,
    feld: 'verspaetungStunden' | 'pumpen' | 'neuner' | 'eingeholt' | 'schnaps',
    wert: unknown,
  ): void {
    const zahl = Math.max(0, Number(wert) || 0);
    this.aendern((ka) => ({
      ...ka,
      teilnehmer: ka.teilnehmer.map((x) => (x.id === t.id ? { ...x, [feld]: zahl } : x)),
    }));
  }

  protected teilnehmerHinzufuegen(): void {
    const mitglied = this.mitgliederService.mitglieder().find((m) => m.id === this.auswahlId());
    if (!mitglied) return;

    this.aendern((ka) => ({ ...ka, teilnehmer: [...ka.teilnehmer, neuerTeilnehmer(mitglied)] }));
    this.auswahlId.set('');
  }

  protected gastAnlegen(): void {
    const name = this.gastName().trim();
    if (!name) return;

    // Kein zweiter Stammdatensatz für denselben Namen — sonst zerfällt die
    // Historie später auf zwei Personen. Gleiche Prüfung wie in der
    // Mitgliederverwaltung (findeNamensdublette).
    const dublette = findeNamensdublette(this.mitgliederService.mitglieder(), name);
    if (dublette) {
      const schonDabei = this.abend()?.teilnehmer.some((t) => t.id === dublette.id);
      this.gastFehler.set(
        schonDabei
          ? `„${dublette.name}“ nimmt an diesem Abend bereits teil.`
          : `„${dublette.name}“ ist bereits erfasst — oben aus der Liste auswählen.`,
      );
      return;
    }

    const gast: Mitglied = { id: crypto.randomUUID(), name, status: 'gastkegler' };
    this.mitgliederService.hinzufuegen(gast);
    this.aendern((ka) => ({ ...ka, teilnehmer: [...ka.teilnehmer, neuerTeilnehmer(gast)] }));

    this.gastName.set('');
    this.gastFehler.set(null);
  }

  protected teilnehmerEntfernen(t: KegelabendTeilnehmer): void {
    if (!confirm(`${t.name} von diesem Abend entfernen?`)) return;

    this.aendern((ka) => ({
      ...ka,
      teilnehmer: ka.teilnehmer.filter((x) => x.id !== t.id),
      // Auch aus allen Runden entfernen, sonst blieben verwaiste Ergebnisse zurück.
      runden: Object.fromEntries(
        Object.entries(ka.runden).map(([spiel, runden]) => [
          spiel,
          (runden ?? []).map((r) => {
            const { [t.id]: _entfernt, ...rest } = r.ergebnisse;
            return { ...r, ergebnisse: rest };
          }),
        ]),
      ),
    }));
  }

  protected rundeHinzufuegen(): void {
    const spiel = this.aktivesSpiel();

    this.aendern((ka) => {
      // Anwesende starten als "mitgespielt", Abwesende als "nicht dabei" —
      // das ist in den meisten Runden die richtige Ausgangslage.
      const ergebnisse: Record<string, SpielStatus> = {};
      for (const t of ka.teilnehmer) {
        ergebnisse[t.id] = t.anwesend ? 'teilgenommen' : 'nicht_teilgenommen';
      }

      const neueRunde: SpielRunde = { id: crypto.randomUUID(), ergebnisse };
      return {
        ...ka,
        runden: { ...ka.runden, [spiel]: [...(ka.runden[spiel] ?? []), neueRunde] },
      };
    });
  }

  protected letzteRundeEntfernen(): void {
    const spiel = this.aktivesSpiel();
    this.aendern((ka) => ({
      ...ka,
      runden: { ...ka.runden, [spiel]: (ka.runden[spiel] ?? []).slice(0, -1) },
    }));
  }

  protected statusWeiter(runde: SpielRunde, teilnehmerId: string): void {
    const aktuell = this.statusVon(runde, teilnehmerId);
    const naechster = STATUS_FOLGE[(STATUS_FOLGE.indexOf(aktuell) + 1) % STATUS_FOLGE.length];
    const spiel = this.aktivesSpiel();

    this.aendern((ka) => ({
      ...ka,
      runden: {
        ...ka.runden,
        [spiel]: (ka.runden[spiel] ?? []).map((r) =>
          r.id === runde.id
            ? { ...r, ergebnisse: { ...r.ergebnisse, [teilnehmerId]: naechster } }
            : r,
        ),
      },
    }));
  }

  protected strafenUebernehmen(): void {
    const ka = this.abend();
    if (!ka) return;

    if (!confirm(`Strafen über ${this.euro(this.strafenSumme())} € als Buchungen anlegen?`)) return;

    const anzahl = this.kegelabendService.strafenUebernehmen(ka, ka.datum);
    this.daten.aenderungVorgemerkt();
    this.uebernahmeMeldung.set(
      `${anzahl} Buchung(en) angelegt. Zum Sichern noch „Änderungen speichern“ drücken.`,
    );
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
      this.uebernahmeMeldung.set(null);
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }
}
