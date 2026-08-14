import { Component, computed, inject, signal } from '@angular/core';
import { FileStorageService } from '../../../core/kegelverein/persistenz/file-storage.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { KegeljahrStore } from '../../../core/kegelverein/kegeljahr.store';
import { BackupEintrag } from '../../../core/kegelverein/persistenz/file-storage.models';
import { Kegelabend, Kegeljahr, Mitglied } from '../../../core/kegelverein/kegelverein.models';

/** Was in einer Sicherung steckt — für die Vorschau vor dem Einspielen. */
interface Vorschau {
  eintrag: BackupEintrag;
  mitglieder?: number;
  bezeichnung?: string;
  buchungen?: number;
  kegelabende?: number;
  fehler?: string;
}

@Component({
  selector: 'app-backup-wiederherstellung',
  templateUrl: './backup-wiederherstellung.component.html',
  styleUrl: './backup-wiederherstellung.component.scss',
})
export class BackupWiederherstellungComponent {
  protected readonly storage = inject(FileStorageService);
  protected readonly daten = inject(VereinsdatenService);
  private readonly store = inject(KegeljahrStore);

  protected readonly eintraege = signal<BackupEintrag[]>([]);
  protected readonly laedt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly meldung = signal<string | null>(null);
  protected readonly vorschau = signal<Vorschau | null>(null);
  protected readonly stelltWiederHer = signal(false);
  protected readonly speichert = signal(false);

  /** Nach Zieldatei gruppiert — sonst geht bei vielen Ständen der Überblick verloren. */
  protected readonly gruppen = computed(() => {
    const nachZiel = new Map<string, BackupEintrag[]>();
    for (const e of this.eintraege()) {
      const liste = nachZiel.get(e.zielDatei) ?? [];
      liste.push(e);
      nachZiel.set(e.zielDatei, liste);
    }
    return [...nachZiel.entries()]
      .map(([zielDatei, staende]) => ({ zielDatei, staende }))
      .sort((a, b) => a.zielDatei.localeCompare(b.zielDatei));
  });

  constructor() {
    void this.aktualisieren();
  }

  protected async aktualisieren(): Promise<void> {
    if (this.storage.status() !== 'verbunden') return;

    this.laedt.set(true);
    this.fehler.set(null);
    try {
      this.eintraege.set(await this.storage.backupsAuflisten());
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'Sicherungen konnten nicht geladen werden');
    } finally {
      this.laedt.set(false);
    }
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    try {
      await this.daten.speichern();
      this.meldung.set('Stand gespeichert.');
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      this.speichert.set(false);
    }
  }

  protected zeitpunkt(e: BackupEintrag): string {
    if (!e.zeitpunkt) return 'Zeitpunkt unbekannt';
    return new Date(e.zeitpunkt).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected istGewaehlt(e: BackupEintrag): boolean {
    return this.vorschau()?.eintrag.dateiname === e.dateiname;
  }

  /**
   * Liest die Sicherung und zeigt ihren Inhalt an. Bewusst getrennt vom
   * Einspielen: erst sehen, was drin ist, dann entscheiden.
   */
  protected async ansehen(e: BackupEintrag): Promise<void> {
    if (this.istGewaehlt(e)) {
      this.vorschau.set(null);
      return;
    }

    this.fehler.set(null);
    this.meldung.set(null);

    try {
      const inhalt = (await this.storage.backupLesen(e.dateiname)) as {
        schemaVersion?: number;
        mitglieder?: Mitglied[];
        kegeljahr?: Kegeljahr & { kegelabende: Kegelabend[] };
      };

      if (e.art === 'mitglieder') {
        this.vorschau.set({ eintrag: e, mitglieder: inhalt.mitglieder?.length ?? 0 });
      } else {
        this.vorschau.set({
          eintrag: e,
          bezeichnung: inhalt.kegeljahr?.bezeichnung,
          buchungen: inhalt.kegeljahr?.buchungen?.length ?? 0,
          kegelabende: inhalt.kegeljahr?.kegelabende?.length ?? 0,
        });
      }
    } catch (fehler) {
      this.vorschau.set({
        eintrag: e,
        fehler: fehler instanceof Error ? fehler.message : 'Sicherung nicht lesbar',
      });
    }
  }

  /**
   * Prüft, ob das geladene Kegeljahr noch auf alle Mitglieder verweisen
   * kann, die in einer Mitglieder-Sicherung enthalten sind.
   *
   * Das Einspielen selbst schreibt nur mitglieder.json und löst keine
   * Prüfung des Kegeljahres aus — ohne diese Vorabkontrolle fiele die
   * Lücke erst beim nächsten Laden auf.
   */
  private fehlendeVerweise(mitglieder: Mitglied[]): number {
    const vorhanden = new Set(mitglieder.map((m) => m.id));
    const kj = this.store.aktuellesKegeljahr();
    if (!kj) return 0;

    const benoetigt = new Set<string>();
    for (const b of kj.buchungen) if (b.mitgliedId) benoetigt.add(b.mitgliedId);
    for (const ka of kj.kegelabende) for (const t of ka.teilnehmer) benoetigt.add(t.id);

    return [...benoetigt].filter((id) => !vorhanden.has(id)).length;
  }

  protected async uebernehmen(v: Vorschau): Promise<void> {
    const was =
      v.eintrag.art === 'mitglieder'
        ? `${v.mitglieder} Mitglieder`
        : `das Kegeljahr „${v.bezeichnung}“`;

    let warnung = '';
    if (v.eintrag.art === 'mitglieder') {
      const inhalt = (await this.storage.backupLesen(v.eintrag.dateiname)) as {
        mitglieder?: Mitglied[];
      };
      const fehlen = this.fehlendeVerweise(inhalt.mitglieder ?? []);
      if (fehlen > 0) {
        warnung =
          `\n\nAchtung: ${fehlen} Verweise aus dem aktuellen Kegeljahr zeigen auf Mitglieder, ` +
          `die in diesem Stand fehlen. Das Speichern würde deshalb abgelehnt, solange nicht ` +
          `auch ein passender Kegeljahr-Stand geladen wird.`;
      }
    }

    const text =
      `Stand vom ${this.zeitpunkt(v.eintrag)} laden und ${was} im Arbeitsstand ersetzen?\n\n` +
      `Auf dem Server ändert sich dabei nichts — erst „Änderungen speichern“ schreibt ` +
      `den Stand fest. Über „Verwerfen“ lässt sich der Schritt zurücknehmen.${warnung}`;
    if (!confirm(text)) return;

    this.stelltWiederHer.set(true);
    this.fehler.set(null);
    try {
      const inhalt = await this.storage.backupEinlesen(v.eintrag);
      this.daten.sicherungUebernehmen(inhalt);

      this.vorschau.set(null);
      this.meldung.set(
        `Stand vom ${this.zeitpunkt(v.eintrag)} geladen. ` +
          `Zum Festschreiben oben „Änderungen speichern“ drücken.`,
      );
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'Sicherung konnte nicht geladen werden');
    } finally {
      this.stelltWiederHer.set(false);
    }
  }
}
