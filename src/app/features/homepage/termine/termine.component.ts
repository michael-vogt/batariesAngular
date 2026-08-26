import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { FileStorageService } from '../../../core/kegelverein/persistenz/file-storage.service';
import { erzeugeUebersicht, jetzt } from '../../../core/kegelverein/termin.logic';
import {
  AbsageArt,
  Kegelabend,
  Kegeltermin,
  Mitglied,
} from '../../../core/kegelverein/kegelverein.models';
import { aktuellerStatus } from '../../../core/kegelverein/mitglied.util';
import { LoginComponent } from '../login/login.component';
import { AnmeldungService } from '../../../core/anmeldung.service';
import { KegelabendService } from '../../../core/kegelverein/kegelabend.service';
import { VereinsdatenService } from '../../../core/kegelverein/vereinsdaten.service';
import { datumKurz } from '../../../shared/format.util';
import { Router } from '@angular/router';

/** Vorschlag für einen neuen Termin: nächster Freitag, 19:30 Uhr. */
function vorschlagBeginn(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const zz = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}T20:00`;
}

type TerminMeldung = {
  terminId: string;
  art: 'ok' | 'fehler';
  text: string
};

@Component({
  selector: 'app-termine',
  imports: [FormsModule, LoginComponent],
  templateUrl: './termine.component.html',
  styleUrl: './termine.component.scss',
})
export class TermineComponent {
  protected readonly termine = inject(TerminService);
  protected readonly storage = inject(FileStorageService);
  private readonly mitgliederService = inject(MitgliederService);
  protected readonly anmeldungService = inject(AnmeldungService);

  protected readonly neuBeginn = signal(vorschlagBeginn());
  protected readonly neuOrt = signal('');
  protected readonly neuNotiz = signal('');

  /** Termin, für den gerade eine Abmeldung erfasst wird. */
  protected readonly abmeldeFuer = signal<string | null>(null);
  protected readonly abmeldeMitgliedId = signal('');
  protected readonly abmeldeGrund = signal('');
  protected readonly formularFehler = signal<string | null>(null);

  constructor() {
    // Termine liegen in einer eigenen Datei und werden geladen, sobald
    // eine Serververbindung besteht.
    effect(() => {
      if (this.storage.status() === 'verbunden' && this.termine.status() === 'leer') {
        void this.termine.laden();
      }
    });
  }

  protected readonly uebersichten = computed(() =>
    this.termine.termine().map((t) => erzeugeUebersicht(t, this.mitgliederService.mitglieder(), this.kegelabendService.kegelabende())),
  );

  /** Aktive Mitglieder, die für diesen Termin noch nicht abgemeldet sind. */
  protected abmeldbare(termin: Kegeltermin) {
    const schon = new Set(termin.abmeldungen.map((a) => a.mitgliedId));
    return this.mitgliederService
      .mitglieder()
      .filter((m) => !schon.has(m.id) && aktuellerStatus(m) === 'aktiv')
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  protected zeitpunktLang(z: string): string {
    return new Date(z).toLocaleString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected zeitpunktKurz(z: string): string {
    return new Date(z).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --- Termine ---------------------------------------------------------

  protected async anlegen(): Promise<void> {
    const beginn = this.neuBeginn();
    if (!beginn) return;

    if (beginn < jetzt() && !confirm('Der Termin liegt in der Vergangenheit. Trotzdem anlegen?')) {
      return;
    }

    this.formularFehler.set(null);
    try {
      await this.termine.terminAnlegen(
        beginn,
        this.neuOrt().trim() || undefined,
        this.neuNotiz().trim() || undefined,
      );
      this.neuOrt.set('');
      this.neuNotiz.set('');
      this.neuBeginn.set(vorschlagBeginn());
    } catch {
      // Fehlertext steht in termine.fehler()
    }
  }

  protected async loeschen(termin: Kegeltermin): Promise<void> {
    const zusatz = termin.abmeldungen.length
      ? `\n\nDabei gehen ${termin.abmeldungen.length} Abmeldungen verloren.`
      : '';
    if (!confirm(`Termin am ${this.zeitpunktKurz(termin.beginn)} löschen?${zusatz}`)) return;

    try {
      await this.termine.terminLoeschen(termin.id);
    } catch {
      // Fehlertext steht in termine.fehler()
    }
  }

  protected readonly terminMeldung = signal<TerminMeldung | null>(null);

  protected meldungFuer(terminId: string): TerminMeldung | null {
    const m = this.terminMeldung();
    return m?.terminId === terminId ? m : null;
  }

  protected readonly kegelabendService = inject(KegelabendService);
  private readonly vereinsdatenService = inject(VereinsdatenService);
  private readonly router = inject(Router);

  protected async kegelterminErzeugen(termin: Kegeltermin): Promise<void> {
    this.terminMeldung.set(null);

    const ort = prompt('An welchem Ort fand das Kegeln statt?');
    if (!ort) return;

    const ka: Kegelabend = {
      id: crypto.randomUUID(),
      datum: termin.beginn.slice(0, 10),
      ort: termin.ort?.trim() ?? ort,
      teilnehmer: this.mitgliederService
        .mitglieder()
        .filter((m) => aktuellerStatus(m) === 'aktiv')
        .map((m) => ({
          id: m.id,
          name: m.name,
          anwesend: !termin.abmeldungen.some((a) => a.mitgliedId === m.id),
          pumpen: 0,
          neuner: 0,
          eingeholt: 0,
          schnaps: 0,
          verspaetungStunden: 0,
          ...this.absageArt(m, termin)
        })),
      runden: {},
    };

    this.kegelabendService.speichern(ka);
    this.vereinsdatenService.aenderungVorgemerkt();

    try {
      await this.vereinsdatenService.speichern();
    } catch {
      this.terminMeldung.set({
        terminId: termin.id,
        art: 'fehler',
        text: this.vereinsdatenService.fehler() ?? 'Speichern fehlgeschlagen.',
      });
      return;
    }

    const gewechselt = await this.router.navigate(['/homepage/verwaltung/kegelabende', ka.id]);

    if (!gewechselt) {
      this.terminMeldung.set({
        terminId: termin.id,
        art: 'ok',
        text: 'Kegelabend wurde angelegt, die Detailseite ließ sich aber nicht öffnen.',
      });
    }
  }

  private absageArt(mitglied: Mitglied, termin: Kegeltermin): { absage?: AbsageArt } {
    const abmeldung = termin.abmeldungen.find((a) => a.mitgliedId === mitglied.id);
    if (!abmeldung) return {};

    const stundenVorher = (new Date(termin.beginn).getTime() - new Date(abmeldung.gemeldetAm).getTime()) / (1000*60*60);
    return { absage: stundenVorher >= 48 ? 'rechtzeitig' : 'kurzfristig'};
  }

  // --- Abmeldungen -----------------------------------------------------

  protected abmeldungOeffnen(termin: Kegeltermin): void {
    const terminId = termin.id;
    this.abmeldeFuer.set(this.abmeldeFuer() === terminId ? null : terminId);

    // Gehört zur angemeldeten Rolle ein Mitglied und ist es für diesen
    // Termin noch abmeldbar, ist es eine sinnvolle Vorauswahl — meist
    // meldet sich jemand ohnehin selbst ab.
    const eigeneMitgliedId = this.anmeldungService.mitgliedId();
    const vorauswahl =
      eigeneMitgliedId && this.abmeldbare(termin).some((m) => m.id === eigeneMitgliedId)
        ? eigeneMitgliedId
        : '';
    this.abmeldeMitgliedId.set(vorauswahl);
    this.abmeldeGrund.set('');
    this.formularFehler.set(null);
  }

  protected async abmelden(terminId: string): Promise<void> {
    const mitgliedId = this.abmeldeMitgliedId();
    const grund = this.abmeldeGrund().trim();

    if (!mitgliedId) {
      this.formularFehler.set('Bitte ein Mitglied auswählen.');
      return;
    }
    if (!grund) {
      this.formularFehler.set('Bitte einen Grund angeben.');
      return;
    }

    try {
      await this.termine.abmelden(terminId, mitgliedId, grund);
      this.abmeldeFuer.set(null);
      this.abmeldeMitgliedId.set('');
      this.abmeldeGrund.set('');
      this.formularFehler.set(null);
    } catch {
      // Fehlertext steht in termine.fehler()
    }
  }

  protected async zuruecknehmen(terminId: string, mitgliedId: string, name: string): Promise<void> {
    if (!confirm(`Abmeldung von ${name} zurücknehmen?`)) return;

    try {
      await this.termine.abmeldungZuruecknehmen(terminId, mitgliedId);
    } catch {
      // Fehlertext steht in termine.fehler()
    }
  }
}
