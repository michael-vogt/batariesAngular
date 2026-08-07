import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MitgliederService } from '../../core/kegelverein/mitglieder.service';
import { AccountingService } from '../../core/kegelverein/accounting.service';
import { VereinsdatenService } from '../../core/kegelverein/vereinsdaten.service';
import { Mitglied, MitgliedStatus } from '../../core/kegelverein/kegelverein.models';
import { findeNamensdublette } from '../../core/kegelverein/namen.util';
import {
  STATUS_BEZEICHNUNG,
  aktuellerStatus,
  mitStatusaenderung,
  neuesMitglied,
  sortierterVerlauf,
} from '../../core/kegelverein/mitglied.util';

const HEUTE = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-mitglieder-liste',
  imports: [FormsModule],
  templateUrl: './mitglieder-liste.component.html',
  styleUrl: './mitglieder-liste.component.scss'
})
export class MitgliederListeComponent {
  private readonly mitgliederService = inject(MitgliederService);
  private readonly accounting = inject(AccountingService);
  protected readonly daten = inject(VereinsdatenService);

  protected readonly mitglieder = this.mitgliederService.mitglieder;

  /** Stammdaten und berechnete Finanzen paarweise für die Tabelle. */
  protected readonly zeilen = computed(() => {
    const finanzen = this.accounting.finanzenAlleMitglieder();
    return this.mitglieder().map(mitglied => ({
      mitglied,
      status: aktuellerStatus(mitglied),
      finanzen:
        finanzen.find(f => f.mitgliedId === mitglied.id) ??
        {
          mitgliedId: mitglied.id,
          offeneBeitraege: 0,
          offeneStrafen: 0,
          offeneUmlagen: 0,
          offeneForderungenGesamt: 0,
          restguthaben: 0,
        },
    }));
  });

  /**
   * Vereinsmitglieder und Gastkegler getrennt: Gäste sammeln sich über die
   * Jahre an und würden die eigentliche Mitgliederliste sonst zuwachsen.
   * Jede Gruppe bekommt ihre eigene Summe — die Vereinssumme soll nicht
   * durch Gästeforderungen verfälscht werden.
   */
  protected readonly gruppen = computed(() => {
    const alle = this.zeilen();
    const bauen = (titel: string, zeilen: typeof alle) => ({
      titel,
      zeilen,
      summeOffen: zeilen.reduce((s, z) => s + z.finanzen.offeneForderungenGesamt, 0),
      summeGuthaben: zeilen.reduce((s, z) => s + z.finanzen.restguthaben, 0),
    });

    return [
      bauen(
        'Vereinsmitglieder',
        alle.filter(z => z.status === 'aktiv' || z.status === 'passiv' || z.status === null),
      ),
      bauen('Gastkegler', alle.filter(z => z.status === 'gastkegler')),
      bauen('Ausgetreten', alle.filter(z => z.status === 'ausgetreten')),
    ].filter(g => g.zeilen.length > 0 || g.titel === 'Vereinsmitglieder');
  });

  protected readonly bearbeiteId = signal<string | null>(null);
  protected readonly entwurfName = signal('');
  protected readonly neuName = signal('');
  protected readonly neuStatus = signal<MitgliedStatus>('aktiv');
  protected readonly neuRolle = signal('');
  protected readonly anlegeFehler = signal<string | null>(null);
  protected readonly bearbeitenFehler = signal<string | null>(null);
  protected readonly verlaufOffen = signal<string | null>(null);
  protected readonly wechselDatum = signal(HEUTE());
  protected readonly wechselStatus = signal<MitgliedStatus>('passiv');
  protected readonly wechselNotiz = signal('');
  protected readonly speichert = signal(false);

  protected euro(betrag: number): string {
    return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected anlegen(): void {
    const name = this.neuName().trim();
    if (!name) return;

    const dublette = findeNamensdublette(this.mitglieder(), name);
    if (dublette) {
      const status = aktuellerStatus(dublette);
      this.anlegeFehler.set(
        `„${dublette.name}“ ist bereits erfasst${status ? ` (${this.statusText(status)})` : ''}.`,
      );
      return;
    }

    this.mitgliederService.hinzufuegen(
      neuesMitglied(name, this.neuStatus(), HEUTE(), this.neuRolle().trim() || undefined),
    );

    this.neuName.set('');
    this.neuRolle.set('');
    this.anlegeFehler.set(null);
    this.daten.aenderungVorgemerkt();
  }

  protected bearbeitungStarten(m: Mitglied): void {
    this.bearbeiteId.set(m.id);
    this.entwurfName.set(m.name);
  }

  protected bearbeitungSpeichern(): void {
    const id = this.bearbeiteId();
    const name = this.entwurfName().trim();
    const mitglied = this.mitglieder().find(m => m.id === id);

    if (!mitglied || !name || name === mitglied.name) {
      this.bearbeitungAbbrechen();
      return;
    }

    // Auch beim Umbenennen darf kein zweiter Eintrag mit gleichem Namen
    // entstehen; das Mitglied selbst ist von der Prüfung ausgenommen.
    const dublette = findeNamensdublette(this.mitglieder(), name, mitglied.id);
    if (dublette) {
      this.bearbeitenFehler.set(`„${dublette.name}“ ist bereits erfasst.`);
      return;
    }

    this.mitgliederService.aktualisieren({ ...mitglied, name });
    this.daten.aenderungVorgemerkt();
    this.bearbeitungAbbrechen();
  }

  protected bearbeitungAbbrechen(): void {
    this.bearbeiteId.set(null);
    this.entwurfName.set('');
    this.bearbeitenFehler.set(null);
  }

  /** Schnellwechsel aus der Tabelle: gilt ab heute. Für rückwirkende
   *  Änderungen den Verlauf aufklappen. */
  protected statusGeaendert(m: Mitglied, status: MitgliedStatus): void {
    if (aktuellerStatus(m) === status) return;
    this.mitgliederService.aktualisieren(mitStatusaenderung(m, status, HEUTE()));
    this.daten.aenderungVorgemerkt();
  }

  protected verlaufUmschalten(id: string): void {
    this.verlaufOffen.update(offen => (offen === id ? null : id));
    this.wechselDatum.set(HEUTE());
    this.wechselNotiz.set('');
  }

  protected verlaufVon(m: Mitglied) {
    return sortierterVerlauf(m);
  }

  protected statusText(status: MitgliedStatus): string {
    return STATUS_BEZEICHNUNG[status];
  }

  protected datumKurz(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE');
  }

  protected wechselEintragen(m: Mitglied): void {
    const ab = this.wechselDatum();
    if (!ab) return;

    this.mitgliederService.aktualisieren(
      mitStatusaenderung(m, this.wechselStatus(), ab, this.wechselNotiz().trim() || undefined),
    );
    this.daten.aenderungVorgemerkt();
    this.wechselNotiz.set('');
  }

  protected loeschen(m: Mitglied): void {
    const finanzen = this.accounting.finanzenAlleMitglieder().find(f => f.mitgliedId === m.id);
    const hatBewegungen =
      (finanzen?.offeneForderungenGesamt ?? 0) !== 0 || (finanzen?.restguthaben ?? 0) !== 0;

    const text = hatBewegungen
      ? `${m.name} hat offene Beträge. Buchungen und Spielabende verlieren die Zuordnung. `
        + `Für Austritte besser den Status auf „ausgetreten“ setzen. Trotzdem endgültig entfernen?`
      : `${m.name} endgültig entfernen? Für Austritte genügt der Status „ausgetreten“.`;

    if (!confirm(text)) return;

    this.mitgliederService.loeschen(m.id);
    this.daten.aenderungVorgemerkt();
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
    } catch {
      // Fehlertext steht bereits in daten.fehler()
    } finally {
      this.speichert.set(false);
    }
  }
}
