import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { KegelabendService } from '../../../core/kegelverein/kegelabend.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { findeNamensdublette } from '../../../core/kegelverein/namen.util';
import {
  aktuellerStatus,
  istGastkegler,
  neuesMitglied,
} from '../../../core/kegelverein/mitglied.util';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { datumKurz, datumLang, euro } from '../../../shared/format.util';
import {
  Kegelabend,
  KegelabendTeilnehmer,
  Mitglied,
  SPIELE,
  SpielKey,
  SpielRunde,
  SpielStatus,
} from '../../../core/kegelverein/kegelverein.models';

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
  templateUrl: './kegelabend-detail.component.html',
  styleUrl: './kegelabend-detail.component.scss',
  imports: [FormsModule, RouterLink],
})
export class KegelabendDetailComponent {
  // Formatierung zentral aus shared/format.util — als Feld gebunden,
  // damit die Templates darauf zugreifen können.
  protected readonly euro = euro;
  protected readonly datumLang = datumLang;
  protected readonly datumKurz = datumKurz;
  /** Kommt aus der Route (withComponentInputBinding). */
  readonly id = input.required<string>();

  /** Bezugspunkt für die Verweise zurück zur Übersicht (eine Ebene höher). */
  protected readonly route = inject(ActivatedRoute);

  private readonly kegelabendService = inject(KegelabendService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly daten = inject(VereinsdatenService);

  constructor() {
    // Läuft bei jedem vollständigen Datenaustausch (Laden, Verwerfen,
    // Jahreswechsel) und räumt die Bedienzustände auf.
    effect(() => {
      this.daten.datenstand();
      this.bedienzustandZuruecksetzen();
    });
  }

  protected readonly spiele = SPIELE;
  protected readonly aktivesSpiel = signal<SpielKey>(SPIELE[0].key);
  protected readonly gastName = signal('');
  protected readonly gastFehler = signal<string | null>(null);
  protected readonly auswahlId = signal('');
  protected readonly speichert = signal(false);
  protected readonly uebernahmeMeldung = signal<string | null>(null);
  protected readonly uebernahmeFehler = signal<string | null>(null);

  protected readonly abend = computed(() =>
    this.kegelabendService.kegelabende().find((ka) => ka.id === this.id()),
  );

  protected readonly runden = computed(() => this.abend()?.runden[this.aktivesSpiel()] ?? []);

  /**
   * Abgerechnete Abende sind schreibgeschützt: ihre Strafen stehen in der
   * Buchführung, spätere Änderungen würden die Auswertung stillschweigend
   * von den gebuchten Beträgen entfernen. Zum Ändern erst die Abrechnung
   * zurücknehmen.
   */
  protected readonly gesperrt = computed(() => !!this.abend()?.strafenUebernommenAm);

  /** Mitglieder, die an diesem Abend noch nicht eingetragen sind. */
  protected readonly verfuegbare = computed(() => {
    const vorhanden = new Set(this.abend()?.teilnehmer.map((t) => t.id) ?? []);
    // Ausgetretene stehen nicht zur Auswahl; historische Abende behalten sie.
    return this.mitgliederService
      .mitglieder()
      .filter((m) => !vorhanden.has(m.id) && aktuellerStatus(m) !== 'ausgetreten');
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
    const m = this.mitgliederService.mitglieder().find((x) => x.id === teilnehmerId);
    return m ? istGastkegler(m) : false;
  }

  // --- Änderungen ------------------------------------------------------
  // Durchgehend unveränderlich: jede Änderung erzeugt neue Objekte, damit
  // die computed()-Ketten zuverlässig neu rechnen.

  private aendern(fn: (ka: Kegelabend) => Kegelabend): void {
    const ka = this.abend();
    if (!ka) return;
    // Zweite Absicherung neben den deaktivierten Feldern: so kann auch ein
    // übersehener Bedienpfad keine Änderung an einem gebuchten Abend machen.
    if (ka.strafenUebernommenAm) return;
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
    if (!name || this.gesperrt()) return;

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

    // Eintritt auf das Datum des Abends datieren — an dem Tag hat er
    // erstmals mitgekegelt.
    const gast = neuesMitglied(name, 'gastkegler', this.abend()!.datum);
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

    this.uebernahmeFehler.set(null);
    try {
      const anzahl = this.kegelabendService.strafenUebernehmen(ka, ka.datum);
      this.daten.aenderungVorgemerkt();
      this.uebernahmeMeldung.set(
        `${anzahl} Buchung(en) angelegt. Zum Sichern noch „Änderungen speichern“ drücken.`,
      );
    } catch (e) {
      // Greift, wenn der Abend bereits abgerechnet ist — etwa wenn die
      // Seite in einem zweiten Fenster offen stand.
      this.uebernahmeFehler.set(e instanceof Error ? e.message : 'Übernahme fehlgeschlagen');
    }
  }

  protected strafenZuruecknehmen(): void {
    const ka = this.abend();
    if (!ka) return;

    if (!confirm('Die Buchungen dieser Abrechnung wieder löschen?')) return;

    this.uebernahmeFehler.set(null);
    const entfernt = this.kegelabendService.strafenZuruecknehmen(ka);
    this.daten.aenderungVorgemerkt();
    this.uebernahmeMeldung.set(
      `${entfernt} Buchung(en) gelöscht. Zum Sichern noch „Änderungen speichern“ drücken.`,
    );
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
      this.uebernahmeMeldung.set(null);
      this.uebernahmeFehler.set(null);
    } catch {
      // Fehlertext steht in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }

  private bedienzustandZuruecksetzen(): void {
    // Auswahl und Meldungen beziehen sich auf den vorherigen Datenstand.
    this.auswahlId.set('');
    this.gastName.set('');
    this.gastFehler.set(null);
    this.uebernahmeMeldung.set(null);
    this.uebernahmeFehler.set(null);
  }
}
