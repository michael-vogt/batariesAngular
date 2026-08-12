import { Injectable, computed, inject, signal } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { Kegeljahr } from './kegelverein.models';
import { FileStorageService, SicherungsInhalt } from './persistenz/file-storage.service';
import { KegeljahrRef, SCHEMA_VERSION } from './persistenz/file-storage.models';
import { AbschlussVorschau, bereiteAbschlussVor } from './jahresabschluss.logic';
import { istSchemaV1, migriereV1 } from './persistenz/file-storage.migration';

export type LadeStatus = 'leer' | 'laedt' | 'bereit' | 'fehler';

/**
 * Bindeglied zwischen Persistenz (Server) und Zustand (KegeljahrStore).
 *
 * Beim Start wird nur das aktuelle Kegeljahr geladen, nicht alle — ältere
 * Jahre sind Archiv und werden erst beim Wechsel nachgeladen. Die Liste
 * aller verfügbaren Jahre kommt aus dem Manifest und ist dadurch trotzdem
 * sofort für einen Jahres-Umschalter verfügbar.
 *
 * Gespeichert wird bewusst nicht bei jeder Änderung, sondern auf Befehl
 * (speichern()): jeder Schreibvorgang legt serverseitig ein Backup an, und
 * das bei jedem Tastendruck zu tun würde die Rotation sinnlos machen.
 */
@Injectable({ providedIn: 'root' })
export class VereinsdatenService {
  private readonly store = inject(KegeljahrStore);
  private readonly storage = inject(FileStorageService);

  private readonly _status = signal<LadeStatus>('leer');
  private readonly _verfuegbareJahre = signal<KegeljahrRef[]>([]);
  private readonly _ungespeichert = signal(false);
  private readonly _fehler = signal<string | null>(null);
  private readonly _migrationsHinweise = signal<string[]>([]);

  readonly status = this._status.asReadonly();
  readonly verfuegbareJahre = this._verfuegbareJahre.asReadonly();
  readonly ungespeichert = this._ungespeichert.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  /** Nicht leer, wenn beim Laden eine Schema-Migration nötig war. */
  readonly migrationsHinweise = this._migrationsHinweise.asReadonly();

  readonly aktuellesJahr = computed(() => this.store.aktuellesKegeljahr());

  /**
   * Wird bei jedem vollständigen Datenaustausch hochgezählt (Laden,
   * Verwerfen, Jahreswechsel). Komponenten setzen darauf ihre offenen
   * Bearbeitungen zurück — siehe KegeljahrStore.datenstand.
   */
  readonly datenstand = this.store.datenstand;

  /** Nach hergestellter Serververbindung aufrufen. */
  async initialisieren(): Promise<void> {
    this._status.set('laedt');
    this._fehler.set(null);
    this._migrationsHinweise.set([]);

    try {
      const manifest = await this.storage.manifestLaden();

      if (manifest.schemaVersion < SCHEMA_VERSION) {
        await this.migrieren(manifest);
        return;
      }

      this._verfuegbareJahre.set(manifest.kegeljahre);
      this.store.setMitglieder((await this.storage.mitgliederLaden()) ?? []);

      const ref =
        manifest.kegeljahre.find((k) => k.id === manifest.aktuellesKegeljahrId) ??
        manifest.kegeljahre[manifest.kegeljahre.length - 1];

      if (!ref) {
        // Frischer Server ohne Kegeljahre — kein Fehler, nur noch nichts da.
        this.store.setKegeljahre([]);
        this._status.set('bereit');
        return;
      }

      const kegeljahr = await this.storage.kegeljahrLaden(ref.datei, this.mitgliedIds());
      this.store.setKegeljahre([kegeljahr], kegeljahr.id);
      this._ungespeichert.set(false);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden');
      this._status.set('fehler');
    }
  }

  /**
   * Einmalige Umstellung von Schema 1 auf 2: Mitglieder aus allen
   * Jahresdateien zusammenführen, als mitglieder.json ablegen und die
   * Jahresdateien ohne Mitgliederliste neu schreiben.
   *
   * Alle betroffenen Dateien werden dabei serverseitig zuvor als Backup
   * gesichert (siehe FileStorageService.kegeljahrSpeichern).
   */
  private async migrieren(manifest: {
    kegeljahre: KegeljahrRef[];
    aktuellesKegeljahrId: string;
  }): Promise<void> {
    const rohdaten = [];
    let bereitsNeu = 0;

    for (const ref of manifest.kegeljahre) {
      const roh = await this.storage.kegeljahrRohLaden(ref.datei);
      if (!roh) continue;
      if (istSchemaV1(roh)) rohdaten.push((roh as { kegeljahr: unknown }).kegeljahr);
      else bereitsNeu++;
    }

    // Schutz gegen Datenverlust: Meldet das Manifest eine alte Version,
    // liegen die Jahresdateien aber bereits im neuen Format vor (z.B. nach
    // einem Neuimport), gibt es nichts zu migrieren. Dann nur das Manifest
    // hochziehen — keinesfalls mit leerem Migrationsergebnis überschreiben.
    if (rohdaten.length === 0) {
      if (bereitsNeu > 0 || manifest.kegeljahre.length === 0) {
        await this.storage.aktuellesKegeljahrSetzen(manifest.aktuellesKegeljahrId);
        await this.initialisieren();
        return;
      }
      throw new Error(
        'Migration nicht möglich: Kegeljahr-Dateien liegen weder im alten noch im neuen Format vor.',
      );
    }

    const ergebnis = migriereV1(rohdaten as Parameters<typeof migriereV1>[0]);

    await this.storage.mitgliederSpeichern(ergebnis.mitglieder);
    const ids = new Set(ergebnis.mitglieder.map((m) => m.id));
    for (const kj of ergebnis.kegeljahre) {
      await this.storage.kegeljahrSpeichern(kj, ids);
    }

    this._migrationsHinweise.set([
      `Datenformat auf Version ${SCHEMA_VERSION} umgestellt: ${ergebnis.mitglieder.length} Mitglieder vereinsweit zusammengeführt.`,
      ...ergebnis.hinweise,
    ]);

    // Nach dem Schreiben regulär laden, damit die Prüfungen greifen.
    await this.initialisieren();
  }

  // ---------------------------------------------------------------
  // Jahresabschluss
  // ---------------------------------------------------------------

  /** Vorschau ohne Seiteneffekt; wirft, wenn das Folgejahr schon existiert. */
  abschlussVorbereiten(): AbschlussVorschau {
    const altesJahr = this.store.aktuellesKegeljahr();
    if (!altesJahr) throw new Error('Kein Kegeljahr ausgewählt.');

    return bereiteAbschlussVor({
      altesJahr,
      mitglieder: this.store.mitglieder(),
      vorhandeneJahre: [
        ...this.store.kegeljahre(),
        // Auch Jahre berücksichtigen, die nur im Manifest stehen und
        // (noch) nicht geladen sind — sonst entstünde ein zweites Jahr
        // für denselben Zeitraum.
        ...this._verfuegbareJahre()
          .filter((ref) => !this.store.kegeljahre().some((kj) => kj.id === ref.id))
          .map((ref) => ({
            id: ref.id,
            bezeichnung: ref.bezeichnung,
            // Zeitraum unbekannt, solange nicht geladen: Kollision wird
            // beim Speichern serverseitig ohnehin über den Dateinamen
            // erkannt. Hier nur ein unmöglicher Bereich als Platzhalter.
            startDatum: '9999-12-31',
            endDatum: '9999-12-31',
            buchungen: [],
            kegelabende: [],
          })),
      ],
    });
  }

  /**
   * Führt den Abschluss aus: legt das Folgejahr an, speichert es und macht
   * es zum aktuellen. Das alte Jahr bleibt unverändert erhalten.
   */
  async abschlussAusfuehren(vorschau: AbschlussVorschau): Promise<void> {
    this._fehler.set(null);
    try {
      // Mitglieder zuerst — die Eröffnungsbuchungen verweisen darauf.
      await this.storage.mitgliederSpeichern(this.store.mitglieder());
      await this.storage.kegeljahrSpeichern(vorschau.neuesKegeljahr, this.mitgliedIds());
      await this.storage.aktuellesKegeljahrSetzen(vorschau.neuesKegeljahr.id);

      this.store.addKegeljahr(vorschau.neuesKegeljahr);
      this._verfuegbareJahre.set((await this.storage.manifestLaden()).kegeljahre);
      this._ungespeichert.set(false);
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Abschluss fehlgeschlagen');
      throw e;
    }
  }

  /**
   * Verwirft alle nicht gespeicherten Änderungen und lädt den zuletzt
   * gespeicherten Stand vom Server neu.
   *
   * Bewusst über einen echten Neuladevorgang statt über einen
   * Rückgängig-Verlauf: der Server ist die Wahrheit, und ein zweiter
   * Zustandsspeicher im Browser könnte davon abweichen.
   */
  async verwerfen(): Promise<void> {
    const bisherigeId = this.store.aktuellesKegeljahr()?.id;

    this._status.set('laedt');
    this._fehler.set(null);

    try {
      this.store.setMitglieder((await this.storage.mitgliederLaden()) ?? []);

      const ref =
        this._verfuegbareJahre().find((k) => k.id === bisherigeId) ??
        this._verfuegbareJahre()[this._verfuegbareJahre().length - 1];

      if (ref) {
        const kegeljahr = await this.storage.kegeljahrLaden(ref.datei, this.mitgliedIds());
        this.store.setKegeljahre([kegeljahr], kegeljahr.id);
      } else {
        // Auf dem Server liegt noch kein Kegeljahr — dann ist der
        // verworfene Stand ein leerer.
        this.store.setKegeljahre([]);
      }

      this._ungespeichert.set(false);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen');
      this._status.set('fehler');
      throw e;
    }
  }

  /**
   * Übernimmt eine gelesene Sicherung in den Arbeitsstand — ohne sie zu
   * speichern. Der Server bleibt unberührt, bis „Änderungen speichern“
   * gedrückt wird; über „Verwerfen“ lässt sich der Schritt zurücknehmen.
   */
  sicherungUebernehmen(inhalt: SicherungsInhalt): void {
    if (inhalt.art === 'mitglieder') {
      this.store.setMitglieder(inhalt.mitglieder);
    } else {
      this.store.setKegeljahre([inhalt.kegeljahr], inhalt.kegeljahr.id);
    }

    // setKegeljahre/setMitglieder zählen den Datenstand hoch, wodurch die
    // Seiten ihre offenen Bearbeitungen zurücksetzen. Als ungespeichert
    // markieren müssen wir dagegen ausdrücklich.
    this._ungespeichert.set(true);
  }

  /**
   * Legt das erste Kegeljahr an — der Einstieg auf einem leeren Server.
   *
   * Alle weiteren Jahre entstehen über den Jahresabschluss, damit die
   * Bestände lückenlos übertragen werden. Deshalb ist diese Funktion
   * bewusst auf den Fall beschränkt, dass noch gar kein Jahr existiert.
   *
   * Anders als sonst wird hier sofort gespeichert: Ohne Kegeljahr gibt es
   * keine Seite, auf der man „Änderungen speichern“ drücken könnte.
   */
  async erstesKegeljahrAnlegen(startDatum: string, endDatum: string): Promise<Kegeljahr> {
    if (this._verfuegbareJahre().length > 0 || this.store.kegeljahre().length > 0) {
      throw new Error(
        'Es existiert bereits ein Kegeljahr. Weitere Jahre entstehen über den Jahresabschluss.',
      );
    }
    if (startDatum >= endDatum) {
      throw new Error('Das Startdatum muss vor dem Enddatum liegen.');
    }

    const kegeljahr: Kegeljahr = {
      id: crypto.randomUUID(),
      bezeichnung: `Kegeljahr ${startDatum.slice(0, 4)}/${endDatum.slice(0, 4)}`,
      startDatum,
      endDatum,
      buchungen: [],
      kegelabende: [],
    };

    this._fehler.set(null);
    try {
      // Stammdaten zuerst, damit mitglieder.json auf einem frischen Server
      // überhaupt existiert — auch wenn sie noch leer ist.
      await this.storage.mitgliederSpeichern(this.store.mitglieder());
      await this.storage.kegeljahrSpeichern(kegeljahr, this.mitgliedIds());
      await this.storage.aktuellesKegeljahrSetzen(kegeljahr.id);

      await this.initialisieren();
      return kegeljahr;
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Kegeljahr konnte nicht angelegt werden');
      throw e;
    }
  }

  private mitgliedIds(): Set<string> {
    return new Set(this.store.mitglieder().map((m) => m.id));
  }

  /** Wechselt das aktive Kegeljahr und lädt es bei Bedarf nach. */
  async kegeljahrWechseln(id: string): Promise<void> {
    if (this.store.kegeljahre().some((kj) => kj.id === id)) {
      this.store.setAktuellesKegeljahr(id);
      return;
    }

    const ref = this._verfuegbareJahre().find((k) => k.id === id);
    if (!ref) throw new Error(`Kegeljahr ${id} ist im Manifest nicht verzeichnet.`);

    this._status.set('laedt');
    try {
      const kegeljahr = await this.storage.kegeljahrLaden(ref.datei, this.mitgliedIds());
      this.store.addKegeljahr(kegeljahr);
      this._status.set('bereit');
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Kegeljahr konnte nicht geladen werden');
      this._status.set('fehler');
    }
  }

  /** Von Komponenten nach jeder Änderung aufzurufen (markiert nur, speichert nicht). */
  aenderungVorgemerkt(): void {
    this._ungespeichert.set(true);
  }

  /**
   * Speichert Stammdaten und aktuelles Kegeljahr. Die Mitglieder zuerst:
   * ein Kegeljahr, das auf ein noch nicht gespeichertes Mitglied verweist,
   * würde die referentielle Prüfung nicht bestehen.
   */
  async speichern(): Promise<void> {
    this._fehler.set(null);
    try {
      await this.storage.mitgliederSpeichern(this.store.mitglieder());

      const kj = this.store.aktuellesKegeljahr();
      if (kj) {
        await this.storage.kegeljahrSpeichern(kj, this.mitgliedIds());
        await this.storage.aktuellesKegeljahrSetzen(kj.id);
      }
      this._ungespeichert.set(false);
    } catch (e) {
      this._fehler.set(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      throw e;
    }
  }
}
