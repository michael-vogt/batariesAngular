import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BERECHTIGUNGSLISTE,
  Berechtigung,
  Berechtigungen,
  KEINE_BERECHTIGUNGEN,
  RolleMitRechten,
  RollenService,
} from '../../../core/rollen.service';

@Component({
  selector: 'app-rollen',
  templateUrl: './rollen.component.html',
  styleUrl: './rollen.component.scss',
  imports: [FormsModule],
})
export class RollenComponent {
  protected readonly rollenService = inject(RollenService);
  protected readonly berechtigungsliste = BERECHTIGUNGSLISTE;

  /**
   * Eigene Zugangsdaten.
   *
   * Jeder lesende und schreibende Aufruf weist sich damit aus — es gibt
   * keine Sitzung. Sie stehen bewusst nicht im Quelltext: Was dort steht,
   * wird mit ausgeliefert und ist in den Entwicklerwerkzeugen jedes
   * Browsers zu lesen.
   */
  protected readonly eigenerName = signal('');
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
  protected readonly bearbeitetRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly bearbeitenFehler = signal<string | null>(null);

  /**
   * Anzahl der Rollen mit Verwaltungsrecht.
   *
   * Die Oberfläche weist darauf hin, wenn es nur noch eine gibt — der
   * Server lehnt das Entziehen dann ohnehin ab, aber besser vorher als
   * nach dem Klick.
   */
  protected readonly anzahlVerwalter = computed(
    () => this.rollen().filter(r => r.berechtigungen.verwaltung).length,
  );

  protected istLetzterVerwalter(rolle: RolleMitRechten): boolean {
    return rolle.berechtigungen.verwaltung && this.anzahlVerwalter() <= 1;
  }

  protected bearbeitenOeffnen(rolle: RolleMitRechten): void {
    if (this.bearbeitet() === rolle.name) {
      this.bearbeitenAbbrechen();
      return;
    }

    this.bearbeitet.set(rolle.name);
    this.bearbeitetName.set(rolle.name);
    this.bearbeitetPasswort.set('');
    this.bearbeitetRechte.set({ ...rolle.berechtigungen });
    this.bearbeitenFehler.set(null);
  }

  protected bearbeitenAbbrechen(): void {
    this.bearbeitet.set(null);
    this.bearbeitetPasswort.set('');
    this.bearbeitenFehler.set(null);
  }

  protected bearbeitetRechtUmschalten(recht: Berechtigung): void {
    this.bearbeitetRechte.update(r => ({ ...r, [recht]: !r[recht] }));
  }

  protected async aenderungSpeichern(): Promise<void> {
    const name = this.bearbeitet();
    if (!name) return;

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
    if (!confirm(`Rolle „${rolle.name}“ löschen? Eine Anmeldung damit ist danach nicht mehr möglich.`))
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
  protected readonly neuRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly legtAn = signal(false);
  protected readonly anlegeFehler = signal<string | null>(null);
  protected readonly anlegeMeldung = signal<string | null>(null);

  protected rechtUmschalten(recht: Berechtigung): void {
    this.neuRechte.update(r => ({ ...r, [recht]: !r[recht] }));
  }

  protected async anlegen(): Promise<void> {
    this.legtAn.set(true);
    this.anlegeFehler.set(null);
    this.anlegeMeldung.set(null);

    const ergebnis = await this.rollenService.rolleAnlegen(
      { name: this.eigenerName(), credential: this.eigenesPasswort() },
      { name: this.neuName(), passwort: this.neuPasswort(), berechtigungen: this.neuRechte() },
    );

    if (ergebnis.angelegt) {
      this.anlegeMeldung.set(`Rolle „${this.neuName()}“ wurde angelegt.`);
      this.neuName.set('');
      this.neuPasswort.set('');
      this.neuRechte.set({ ...KEINE_BERECHTIGUNGEN });
      if (this.geladen()) await this.ladeRollen();
    } else {
      this.anlegeFehler.set(ergebnis.meldung);
    }

    this.legtAn.set(false);
  }
}
