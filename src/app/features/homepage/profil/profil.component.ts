import { Component, computed, effect, inject, signal } from '@angular/core';
import { AnmeldungService } from '../../../core/anmeldung.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { AccountingService } from '../../../core/kegelverein/accounting.service';
import { FileStorageService } from '../../../core/kegelverein/persistenz/file-storage.service';
import { berechneMitgliedFinanzen } from '../../../core/kegelverein/accounting.logic';
import {
  eigeneBuchungen,
  eigeneSpielBilanz,
  eigeneTermine,
} from '../../../core/kegelverein/profil.logic';
import { aktuellerStatus, sortierterVerlauf } from '../../../core/kegelverein/mitglied.util';
import { KONTENRAHMEN } from '../../../core/kegelverein/kegelverein.models';
import { datumKurz, euro } from '../../../shared/format.util';

/**
 * Die eigene Übersicht: Was schulde ich, wo bin ich abgemeldet, wie
 * stehe ich im Spiel?
 *
 * Die Seite zeigt ausschließlich Daten der angemeldeten Rolle. Sie
 * erscheint im Menü nur, wenn die Rolle einem Mitglied zugeordnet ist —
 * ohne Zuordnung gäbe es nichts anzuzeigen.
 */
@Component({
  selector: 'app-profil',
  imports: [],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.scss',
})
export class ProfilComponent {
  protected readonly anmeldung = inject(AnmeldungService);
  protected readonly daten = inject(VereinsdatenService);
  private readonly mitgliederService = inject(MitgliederService);
  private readonly termine = inject(TerminService);
  private readonly accounting = inject(AccountingService);
  private readonly storage = inject(FileStorageService);

  protected readonly euro = euro;
  protected readonly datumKurz = datumKurz;

  /** Alle Buchungen zeigen oder nur die letzten fünf. */
  protected readonly alleBuchungen = signal(false);

  constructor() {
    // Die Seite liegt außerhalb der Verwaltung, wo die Vereinsdaten sonst
    // geladen werden. Ohne sie gäbe es keinen Abrechnungsstand.
    effect(() => {
      if (this.storage.status() !== 'verbunden') return;
      if (this.daten.status() === 'leer') void this.daten.initialisieren();
      if (this.termine.status() === 'leer') void this.termine.laden();
    });
  }

  // --- Wer bin ich -------------------------------------------------------

  protected readonly mitglied = computed(() => {
    const id = this.anmeldung.mitgliedId();
    return id ? (this.mitgliederService.mitglieder().find(m => m.id === id) ?? null) : null;
  });

  protected readonly status = computed(() => {
    const m = this.mitglied();
    return m ? aktuellerStatus(m) : null;
  });

  /** Frühester Eintrag im Statusverlauf — der Beitritt. */
  protected readonly mitgliedSeit = computed(() => {
    const m = this.mitglied();
    return m ? (sortierterVerlauf(m)[0]?.ab ?? null) : null;
  });

  protected readonly verlauf = computed(() => {
    const m = this.mitglied();
    return m ? [...sortierterVerlauf(m)].reverse() : [];
  });

  // --- Abrechnungsstand --------------------------------------------------

  protected readonly finanzen = computed(() => {
    const m = this.mitglied();
    return m ? berechneMitgliedFinanzen(m.id, this.accounting.buchungen()) : null;
  });

  /**
   * Was unterm Strich zu zahlen ist: offene Forderungen abzüglich des
   * Guthabens. Ein negativer Wert bedeutet Guthaben.
   */
  protected readonly zuZahlen = computed(() => {
    const f = this.finanzen();
    if (!f) return 0;
    return Math.round((f.offeneForderungenGesamt - f.restguthaben) * 100) / 100;
  });

  // --- Termine -----------------------------------------------------------

  protected readonly termineStand = computed(() => {
    const m = this.mitglied();
    return m ? eigeneTermine(m.id, this.termine.termine()) : [];
  });

  protected readonly anzahlAbmeldungen = computed(
    () => this.termineStand().filter(t => t.abgemeldet).length,
  );

  protected zeitpunkt(z: string): string {
    return new Date(z).toLocaleString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --- Spielbilanz -------------------------------------------------------

  protected readonly bilanz = computed(() => {
    const m = this.mitglied();
    return m ? eigeneSpielBilanz(m.id, this.daten.aktuellesJahr()?.kegelabende ?? []) : null;
  });

  // --- Eigene Buchungen --------------------------------------------------

  private readonly alleEigenen = computed(() => {
    const m = this.mitglied();
    return m ? eigeneBuchungen(m.id, this.accounting.buchungen()) : [];
  });

  protected readonly buchungen = computed(() =>
    this.alleBuchungen() ? this.alleEigenen() : this.alleEigenen().slice(0, 5),
  );

  protected readonly weitereBuchungen = computed(() =>
    Math.max(0, this.alleEigenen().length - 5),
  );

  protected kontoName(nummer: string): string {
    return KONTENRAHMEN.find(k => k.nummer === nummer)?.name ?? nummer;
  }

  /**
   * Aus Sicht des Mitglieds: Eine Buchung auf das Forderungskonto ist
   * eine Belastung, eine Gegenbuchung darauf eine Gutschrift.
   */
  protected istBelastung(sollKonto: string): boolean {
    return sollKonto === '100';
  }
}
