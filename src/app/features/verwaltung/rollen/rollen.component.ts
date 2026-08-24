import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BERECHTIGUNGSLISTE,
  Berechtigung,
  Berechtigungen,
  KEINE_BERECHTIGUNGEN,
  RolleMitRechten,
  RollenService,
} from '../../../core/rollen.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { AnmeldungService } from '../../../core/anmeldung.service';

/** Einheitliches Ergebnis für beide Schreibwege. */
type Schreibergebnis = { erfolg: true; name: string } | { erfolg: false; meldung: string };

@Component({
  selector: 'app-rollen',
  templateUrl: './rollen.component.html',
  styleUrl: './rollen.component.scss',
  imports: [FormsModule],
})
export class RollenComponent {
  protected readonly rollenService = inject(RollenService);
  protected readonly berechtigungsliste = BERECHTIGUNGSLISTE;
  protected readonly anmeldung = inject(AnmeldungService);

  private readonly mitgliederService = inject(MitgliederService);

  /** Mitglieder zur Auswahl, nach Namen sortiert. */
  protected readonly mitglieder = computed(() =>
    [...this.mitgliederService.mitglieder()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
  );

  // --- Zugang ------------------------------------------------------------

  /**
   * Eigene Zugangsdaten.
   *
   * Jeder lesende und schreibende Aufruf weist sich damit aus — es gibt
   * keine Sitzung. Sie stehen bewusst nicht im Quelltext: Was dort steht,
   * wird mit ausgeliefert und ist in den Entwicklerwerkzeugen jedes
   * Browsers zu lesen.
   */
  protected readonly eigenerName = linkedSignal(() => this.anmeldung.name());
  protected readonly eigenesPasswort = signal('');

  protected readonly rollen = signal<RolleMitRechten[]>([]);
  protected readonly geladen = signal(false);
  protected readonly ladeFehler = signal<string | null>(null);
  protected readonly laedt = signal(false);

  protected async ladeRollen(): Promise<void> {
    if (!this.eigenerName() || !this.eigenesPasswort()) {
      this.ladeFehler.set('Bitte eigenen Rollennamen und Passwort angeben.');
      return;
    }

    this.laedt.set(true);
    this.ladeFehler.set(null);

    const liste = await this.rollenService.rollenMitRechten(
      this.eigenerName(),
      this.eigenesPasswort(),
    );

    if (liste === null) {
      this.rollen.set([]);
      this.geladen.set(false);
      this.ladeFehler.set(
        'Zugangsdaten stimmen nicht, oder diese Rolle darf die Liste nicht einsehen.',
      );
    } else {
      this.rollen.set(liste);
      this.geladen.set(true);
    }

    this.laedt.set(false);
  }

  // --- Anzeige der Liste -------------------------------------------------

  protected mitgliedName(id: string | null): string {
    if (!id) return '';
    return this.mitglieder().find(m => m.id === id)?.name ?? 'unbekannt';
  }

  protected zuordnungVerwaist(id: string | null): boolean {
    return !!id && !this.mitglieder().some(m => m.id === id);
  }

  /**
   * Anzahl der Rollen mit Verwaltungsrecht.
   *
   * Grundlage für die Sperre gegen Aussperren: Verlöre die letzte Rolle
   * dieses Recht oder würde gelöscht, käme niemand mehr an die
   * Rollenverwaltung. Der Server lehnt das ohnehin ab — die Oberfläche
   * sagt es aber besser vorher als nach dem Klick.
   */
  protected readonly anzahlVerwalter = computed(
    () => this.rollen().filter(r => r.berechtigungen.verwaltung).length,
  );

  protected istLetzterVerwalter(rolle: RolleMitRechten): boolean {
    return rolle.berechtigungen.verwaltung && this.anzahlVerwalter() <= 1;
  }

  // --- Ein Formular für Anlegen und Bearbeiten ---------------------------

  /**
   * Name der Rolle, die gerade bearbeitet wird — null bedeutet: eine neue
   * Rolle anlegen.
   *
   * Ein Formular für beides statt zweier: Die Felder sind dieselben, und
   * zwei gleichzeitig offene Formulare wären eine gute Gelegenheit, das
   * falsche abzuschicken.
   */
  protected readonly bearbeitet = signal<string | null>(null);

  protected readonly formName = signal('');
  protected readonly formPasswort = signal('');
  protected readonly formPasswortWdh = signal('');
  protected readonly formRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly formMitgliedId = signal('');

  protected readonly speichert = signal(false);
  protected readonly formFehler = signal<string | null>(null);
  protected readonly formMeldung = signal<string | null>(null);

  private readonly nameFeld = viewChild<ElementRef<HTMLInputElement>>('nameFeld');

  /** Beschriftungen wechseln mit dem Zweck des Formulars. */
  protected readonly formTitel = computed(() => {
    const name = this.bearbeitet();
    return name ? `Rolle „${name}“ bearbeiten` : 'Neue Rolle anlegen';
  });

  protected readonly formKnopf = computed(() =>
    this.bearbeitet() ? 'Änderung speichern' : 'Rolle anlegen',
  );

  /** Beim Bearbeiten ist ein leeres Passwortfeld zulässig. */
  protected readonly passwortHinweis = computed(() =>
    this.bearbeitet() ? 'leer = unverändert' : 'mindestens 8 Zeichen',
  );

  protected readonly passwortWeichtAb = computed(
    () => this.formPasswortWdh() !== '' && this.formPasswort() !== this.formPasswortWdh(),
  );

  /** Die letzte Verwaltungsrolle darf ihr Recht nicht verlieren. */
  protected readonly verwaltungGesperrt = computed(() => {
    const name = this.bearbeitet();
    if (!name) return false;

    const rolle = this.rollen().find(r => r.name === name);
    return !!rolle && this.istLetzterVerwalter(rolle);
  });

  protected rechtUmschalten(recht: Berechtigung): void {
    this.formRechte.update(r => ({ ...r, [recht]: !r[recht] }));
  }

  // --- Formular öffnen ---------------------------------------------------

  protected bearbeitenOeffnen(rolle: RolleMitRechten): void {
    if (this.bearbeitet() === rolle.name) {
      this.formularZuruecksetzen();
      return;
    }

    this.bearbeitet.set(rolle.name);
    this.formName.set(rolle.name);
    this.formPasswort.set('');
    this.formPasswortWdh.set('');
    this.formRechte.set({ ...rolle.berechtigungen });
    this.formMitgliedId.set(rolle.mitgliedId ?? '');
    this.formFehler.set(null);
    this.formMeldung.set(null);

    this.zumFormular();
  }

  /**
   * Übernimmt die Rechte einer Rolle in ein neues Formular.
   *
   * Die Mitgliedszuordnung wird bewusst nicht mitkopiert: Ein Duplikat
   * entsteht meist für eine andere Person, und eine übernommene Zuordnung
   * wäre dann falsch, ohne aufzufallen.
   */
  protected duplizieren(rolle: RolleMitRechten): void {
    this.bearbeitet.set(null);
    this.formName.set('');
    this.formPasswort.set('');
    this.formPasswortWdh.set('');
    this.formRechte.set({ ...rolle.berechtigungen });
    this.formMitgliedId.set('');
    this.formFehler.set(null);
    this.formMeldung.set(`Rechte von „${rolle.name}“ übernommen — Name und Passwort fehlen noch.`);

    this.zumFormular();
  }

  protected formularZuruecksetzen(): void {
    this.bearbeitet.set(null);
    this.formName.set('');
    this.formPasswort.set('');
    this.formPasswortWdh.set('');
    this.formRechte.set({ ...KEINE_BERECHTIGUNGEN });
    this.formMitgliedId.set('');
    this.formFehler.set(null);
    this.formMeldung.set(null);
  }

  /** Zum Formular scrollen und den Namen fokussieren. */
  private zumFormular(): void {
    const feld = this.nameFeld()?.nativeElement;
    // Erst scrollen, dann fokussieren — preventScroll verhindert, dass
    // der Browser danach noch einmal hart springt.
    feld?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    feld?.focus({ preventScroll: true });
  }

  // --- Absenden ----------------------------------------------------------

  protected async speichern(): Promise<void> {
    if (this.formPasswort() !== this.formPasswortWdh()) {
      this.formFehler.set('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    this.speichert.set(true);
    this.formFehler.set(null);
    this.formMeldung.set(null);

    const ausweis = { name: this.eigenerName(), credential: this.eigenesPasswort() };
    const bearbeiteter = this.bearbeitet();
    const ergebnis = bearbeiteter
      ? await this.aendern(ausweis, bearbeiteter)
      : await this.anlegen(ausweis);

    if (ergebnis.erfolg) {
      const meldung = bearbeiteter
        ? `Rolle „${ergebnis.name}“ wurde geändert.`
        : `Rolle „${ergebnis.name}“ wurde angelegt.`;
      this.formularZuruecksetzen();
      this.formMeldung.set(meldung);
      if (this.geladen()) await this.ladeRollen();
    } else {
      this.formFehler.set(ergebnis.meldung);
    }

    this.speichert.set(false);
  }

  private aendern(
    ausweis: { name: string; credential: string },
    name: string,
  ): Promise<Schreibergebnis> {
    return this.rollenService.rolleAendern(ausweis, {
      name,
      neuerName: this.formName().trim() || undefined,
      // Leeres Feld heißt: Passwort bleibt, wie es ist.
      passwort: this.formPasswort() || undefined,
      berechtigungen: this.formRechte(),
      // Leere Auswahl heißt ausdrücklich "Zuordnung lösen".
      mitgliedId: this.formMitgliedId() || '',
    });
  }

  private async anlegen(ausweis: {
    name: string;
    credential: string;
  }): Promise<Schreibergebnis> {
    const name = this.formName().trim();

    const antwort = await this.rollenService.rolleAnlegen(ausweis, {
      name,
      passwort: this.formPasswort(),
      berechtigungen: this.formRechte(),
      mitgliedId: this.formMitgliedId() || null,
    });

    return antwort.angelegt ? { erfolg: true, name } : { erfolg: false, meldung: antwort.meldung };
  }

  protected async loeschen(rolle: RolleMitRechten): Promise<void> {
    if (
      !confirm(`Rolle „${rolle.name}“ löschen? Eine Anmeldung damit ist danach nicht mehr möglich.`)
    ) {
      return;
    }

    this.speichert.set(true);
    this.formFehler.set(null);

    const ergebnis = await this.rollenService.rolleLoeschen(
      { name: this.eigenerName(), credential: this.eigenesPasswort() },
      rolle.name,
    );

    if (ergebnis.erfolg) {
      // Wurde gerade diese Rolle bearbeitet, zeigt das Formular auf etwas,
      // das es nicht mehr gibt.
      if (this.bearbeitet() === rolle.name) this.formularZuruecksetzen();
      await this.ladeRollen();
    } else {
      this.formFehler.set(ergebnis.meldung);
    }

    this.speichert.set(false);
  }
}
