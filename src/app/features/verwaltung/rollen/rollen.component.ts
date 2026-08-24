import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import {
  BERECHTIGUNGSLISTE,
  Berechtigung,
  Berechtigungen,
  KEINE_BERECHTIGUNGEN,
  RolleMitRechten,
  RollenService,
} from '../../../core/rollen.service';
import { AnmeldungService } from '../../../core/anmeldung.service';

@Component({
  selector: 'app-rollen',
  templateUrl: './rollen.component.html',
  styleUrl: './rollen.component.scss',
  imports: [FormsModule],
})
export class RollenComponent {
  protected readonly rollenService = inject(RollenService);
  protected readonly berechtigungsliste = BERECHTIGUNGSLISTE;

  private readonly anmeldungService = inject(AnmeldungService);
  private readonly mitgliederService = inject(MitgliederService);

  /** Mitglieder zur Auswahl, nach Namen sortiert. */
  protected readonly mitglieder = computed(() =>
    [...this.mitgliederService.mitglieder()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
  );

  /**
   * Name zu einer Mitgliedskennung.
   *
   * Verweist eine Rolle auf ein inzwischen gelöschtes Mitglied, steht
   * hier „unbekannt“ — die Oberfläche hebt das farblich hervor, damit es
   * auffällt statt still danebenzustehen.
   */
  protected mitgliedName(id: string | null): string {
    if (!id) return '';
    return this.mitglieder().find((m) => m.id === id)?.name ?? 'unbekannt';
  }

  protected zuordnungVerwaist(id: string | null): boolean {
    return !!id && !this.mitglieder().some((m) => m.id === id);
  }

  /**
   * Eigene Zugangsdaten.
   *
   * Jeder lesende und schreibende Aufruf weist sich damit aus — es gibt
   * keine Sitzung. Sie stehen bewusst nicht im Quelltext: Was dort steht,
   * wird mit ausgeliefert und ist in den Entwicklerwerkzeugen jedes
   * Browsers zu lesen.
   */
  protected readonly eigenerName = signal(this.anmeldungService.name());
  protected readonly eigenesPasswort = signal('');

  protected readonly rollen = signal<RolleMitRechten[]>([]);
  protected readonly geladen = signal(false);
  protected readonly ladeFehler = signal<string | null>(null);
  protected readonly laedt = signal(false);

  // --- Laden -------------------------------------------------------------

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

  // --- Bearbeiten --------------------------------------------------------

  /** Name der Rolle, die gerade bearbeitet wird. */
  protected readonly bearbeitet = signal<string | null>(null);
  protected readonly bearbeitetName = signal('');
  protected readonly bearbeitetPasswort = signal('');
  protected readonly bearbeitetPasswortWdh = signal('');
  protected readonly bearbeitetRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly bearbeitetMitgliedId = signal('');
  protected readonly bearbeitenFehler = signal<string | null>(null);

  /**
   * Weichen die beiden Passwortfelder voneinander ab?
   *
   * Erst ab dem ersten Zeichen im Wiederholungsfeld — sonst stünde die
   * Meldung schon da, bevor überhaupt getippt wurde.
   */
  protected readonly bearbeitetPasswortWeichtAb = computed(
    () =>
      this.bearbeitetPasswortWdh() !== '' &&
      this.bearbeitetPasswort() !== this.bearbeitetPasswortWdh(),
  );

  /**
   * Anzahl der Rollen mit Verwaltungsrecht.
   *
   * Die Oberfläche weist darauf hin, wenn es nur noch eine gibt — der
   * Server lehnt das Entziehen dann ohnehin ab, aber besser vorher als
   * nach dem Klick.
   */
  protected readonly anzahlVerwalter = computed(
    () => this.rollen().filter((r) => r.berechtigungen.verwaltung).length,
  );

  protected istLetzterVerwalter(rolle: RolleMitRechten): boolean {
    return rolle.berechtigungen.verwaltung && this.anzahlVerwalter() <= 1;
  }

  /** Eingabefeld für den Namen der neuen Rolle — Ziel beim Duplizieren. */
  private readonly neuNameFeld = viewChild<ElementRef<HTMLInputElement>>('neuNameFeld');

  /**
   * Übernimmt die Rechte einer Rolle in das Formular unten.
   *
   * Die Mitgliedszuordnung wird bewusst nicht mitkopiert: Ein Duplikat
   * entsteht meist für eine andere Person, und eine übernommene Zuordnung
   * wäre dann falsch, ohne aufzufallen.
   *
   * Ein offenes Bearbeitungsformular wird geschlossen — sonst stünden
   * zwei Formulare gleichzeitig offen, die verschiedene Rollen meinen.
   */
  protected duplizieren(rolle: RolleMitRechten): void {
    this.bearbeitenAbbrechen();

    this.neuRechte.set({ ...rolle.berechtigungen });
    this.neuName.set('');
    this.neuPasswort.set('');
    this.neuPasswortWdh.set('');
    this.neuMitgliedId.set('');
    this.anlegeFehler.set(null);
    this.anlegeMeldung.set(
      `Rechte von „${rolle.name}“ übernommen — Name und Passwort fehlen noch.`,
    );

    const feld = this.neuNameFeld()?.nativeElement;
    // Das Formular steht unterhalb der Tabelle; ohne Scrollen wäre der
    // Fokus im nicht sichtbaren Bereich.
    feld?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    feld?.focus({ preventScroll: true });
  }

  protected bearbeitenOeffnen(rolle: RolleMitRechten): void {
    if (this.bearbeitet() === rolle.name) {
      this.bearbeitenAbbrechen();
      return;
    }

    this.bearbeitet.set(rolle.name);
    this.bearbeitetName.set(rolle.name);
    this.bearbeitetPasswort.set('');
    this.bearbeitetPasswortWdh.set('');
    this.bearbeitetRechte.set({ ...rolle.berechtigungen });
    this.bearbeitetMitgliedId.set(rolle.mitgliedId ?? '');
    this.bearbeitenFehler.set(null);
  }

  protected bearbeitenAbbrechen(): void {
    this.bearbeitet.set(null);
    this.bearbeitetPasswort.set('');
    this.bearbeitetPasswortWdh.set('');
    this.bearbeitenFehler.set(null);
  }

  protected bearbeitetRechtUmschalten(recht: Berechtigung): void {
    this.bearbeitetRechte.update((r) => ({ ...r, [recht]: !r[recht] }));
  }

  protected async aenderungSpeichern(): Promise<void> {
    const name = this.bearbeitet();
    if (!name) return;

    // Nur prüfen, wenn überhaupt ein neues Passwort gesetzt werden soll —
    // beide Felder leer heißt: Passwort bleibt, wie es ist.
    if (this.bearbeitetPasswort() !== this.bearbeitetPasswortWdh()) {
      this.bearbeitenFehler.set('Die beiden Passwörter stimmen nicht überein.');
      return;
    }

    this.laedt.set(true);
    this.bearbeitenFehler.set(null);

    const ergebnis = await this.rollenService.rolleAendern(
      { name: this.eigenerName(), credential: this.eigenesPasswort() },
      {
        name,
        neuerName: this.bearbeitetName().trim() || undefined,
        // Leeres Feld heißt: Passwort bleibt, wie es ist.
        passwort: this.bearbeitetPasswort() || undefined,
        berechtigungen: this.bearbeitetRechte(),
        // Leere Auswahl bedeutet ausdrücklich "Zuordnung lösen", nicht
        // "unverändert" — deshalb immer mitschicken.
        mitgliedId: this.bearbeitetMitgliedId() || '',
      },
    );

    if (ergebnis.erfolg) {
      this.bearbeitenAbbrechen();
      await this.ladeRollen();
    } else {
      this.bearbeitenFehler.set(ergebnis.meldung);
    }

    this.laedt.set(false);
  }

  protected async loeschen(rolle: RolleMitRechten): Promise<void> {
    if (
      !confirm(`Rolle „${rolle.name}“ löschen? Eine Anmeldung damit ist danach nicht mehr möglich.`)
    )
      return;

    this.laedt.set(true);
    this.bearbeitenFehler.set(null);

    const ergebnis = await this.rollenService.rolleLoeschen(
      { name: this.eigenerName(), credential: this.eigenesPasswort() },
      rolle.name,
    );

    if (ergebnis.erfolg) {
      this.bearbeitenAbbrechen();
      await this.ladeRollen();
    } else {
      this.bearbeitenFehler.set(ergebnis.meldung);
    }

    this.laedt.set(false);
  }

  // --- Anlegen -----------------------------------------------------------

  protected readonly neuName = signal('');
  protected readonly neuPasswort = signal('');
  protected readonly neuPasswortWdh = signal('');
  protected readonly neuRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly neuMitgliedId = signal('');
  protected readonly legtAn = signal(false);
  protected readonly anlegeFehler = signal<string | null>(null);
  protected readonly anlegeMeldung = signal<string | null>(null);

  protected readonly neuPasswortWeichtAb = computed(
    () => this.neuPasswortWdh() !== '' && this.neuPasswort() !== this.neuPasswortWdh(),
  );

  protected rechtUmschalten(recht: Berechtigung): void {
    this.neuRechte.update((r) => ({ ...r, [recht]: !r[recht] }));
  }

  protected async anlegen(): Promise<void> {
    if (this.neuPasswort() !== this.neuPasswortWdh()) {
      this.anlegeFehler.set('Die beiden Passwörter stimmen nicht überein.');
      this.anlegeMeldung.set(null);
      return;
    }

    this.legtAn.set(true);
    this.anlegeFehler.set(null);
    this.anlegeMeldung.set(null);

    const ergebnis = await this.rollenService.rolleAnlegen(
      { name: this.eigenerName(), credential: this.eigenesPasswort() },
      {
        name: this.neuName(),
        passwort: this.neuPasswort(),
        berechtigungen: this.neuRechte(),
        mitgliedId: this.neuMitgliedId() || null,
      },
    );

    if (ergebnis.angelegt) {
      this.anlegeMeldung.set(`Rolle „${this.neuName()}“ wurde angelegt.`);
      this.neuName.set('');
      this.neuPasswort.set('');
      this.neuPasswortWdh.set('');
      this.neuRechte.set({ ...KEINE_BERECHTIGUNGEN });
      this.neuMitgliedId.set('');
      if (this.geladen()) await this.ladeRollen();
    } else {
      this.anlegeFehler.set(ergebnis.meldung);
    }

    this.legtAn.set(false);
  }
}
