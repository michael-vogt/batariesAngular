import { Injectable, inject, signal } from '@angular/core';
import { PERSISTENZ_ADAPTER } from './persistenz-adapter.token';
import {
  KegeljahrDatei,
  MITGLIEDER_DATEI,
  Manifest,
  MitgliederDatei,
  SCHEMA_VERSION,
  dateinameFuerKegeljahr,
  leeresManifest,
} from './file-storage.models';
import {
  pruefeKegeljahrDatei,
  pruefeManifest,
  pruefeMitgliederDatei,
} from './file-storage.validation';
import { Kegeljahr, Mitglied } from '../kegelverein.models';

const MAX_BACKUPS_PRO_DATEI = 15;

export type VerbindungsStatus = 'nicht_verbunden' | 'verbunden';

/**
 * Orchestriert Manifest + Kegeljahr-Dateien + Backup-Rotation über den
 * PersistenzAdapter. Kennt das HTTP-/Server-Detail nicht selbst, sondern
 * nur das Adapter-Interface — dadurch bleibt der Service ohne laufenden
 * Webserver testbar (Adapter durch In-Memory-Fake ersetzen).
 */
@Injectable({ providedIn: 'root' })
export class FileStorageService {
  private readonly adapter = inject(PERSISTENZ_ADAPTER);

  private readonly _status = signal<VerbindungsStatus>('nicht_verbunden');
  readonly status = this._status.asReadonly();

  /** Beim App-Start aufrufen: reaktiviert eine zuvor gespeicherte Serververbindung. */
  async automatischVerbinden(): Promise<boolean> {
    const ok = await this.adapter.verbindungWiederherstellen();
    this._status.set(ok ? 'verbunden' : 'nicht_verbunden');
    if (ok) await this.manifestSicherstellen();
    return ok;
  }

  /**
   * Nach erfolgreichem PhpApiAdapter.verbinden() aufrufen, damit der
   * Service den Status übernimmt und manifest.json initial anlegt.
   */
  async verbindungUebernehmen(): Promise<boolean> {
    const ok = this.adapter.hatVerbindung();
    this._status.set(ok ? 'verbunden' : 'nicht_verbunden');
    if (ok) await this.manifestSicherstellen();
    return ok;
  }

  /** Setzt den Status zurück; die eigentlichen Zugangsdaten löscht der Adapter. */
  verbindungGetrennt(): void {
    this._status.set('nicht_verbunden');
  }

  private pruefeVerbunden(): void {
    if (this.status() !== 'verbunden') {
      throw new Error('Keine Serververbindung. Zuerst Zugangsdaten eingeben und verbinden.');
    }
  }

  private async manifestSicherstellen(): Promise<Manifest> {
    const inhalt = await this.adapter.dateiLesen('manifest.json');
    if (inhalt === null) {
      const neu = leeresManifest();
      await this.manifestSchreiben(neu);
      return neu;
    }
    return pruefeManifest(JSON.parse(inhalt));
  }

  async manifestLaden(): Promise<Manifest> {
    this.pruefeVerbunden();
    return this.manifestSicherstellen();
  }

  private async manifestSchreiben(manifest: Manifest): Promise<void> {
    // Beim Schreiben immer auf die aktuelle Version heben: sobald alle
    // Dateien im neuen Format vorliegen, darf das Manifest nicht länger
    // eine ältere Version melden — sonst liefe die Migration erneut an.
    const aktuell: Manifest = { ...manifest, schemaVersion: SCHEMA_VERSION };
    await this.adapter.dateiSchreiben('manifest.json', JSON.stringify(aktuell, null, 2));
  }

  async kegeljahrLaden(datei: string, bekannteMitgliedIds?: Set<string>): Promise<Kegeljahr> {
    this.pruefeVerbunden();
    const inhalt = await this.adapter.dateiLesen(`kegeljahre/${datei}`);
    if (inhalt === null) throw new Error(`Kegeljahr-Datei "${datei}" nicht gefunden.`);
    const geparst = pruefeKegeljahrDatei(JSON.parse(inhalt), bekannteMitgliedIds);
    return geparst.kegeljahr;
  }

  /** Ungeprüfter Zugriff — nur für die Migration älterer Schema-Versionen. */
  async kegeljahrRohLaden(datei: string): Promise<unknown | null> {
    this.pruefeVerbunden();
    const inhalt = await this.adapter.dateiLesen(`kegeljahre/${datei}`);
    return inhalt === null ? null : JSON.parse(inhalt);
  }

  // --- Vereinsweite Stammdaten ---------------------------------------

  /** `null`, wenn noch keine Stammdatendatei existiert (frischer Server). */
  async mitgliederLaden(): Promise<Mitglied[] | null> {
    this.pruefeVerbunden();
    const inhalt = await this.adapter.dateiLesen(MITGLIEDER_DATEI);
    if (inhalt === null) return null;
    return pruefeMitgliederDatei(JSON.parse(inhalt)).mitglieder;
  }

  async mitgliederSpeichern(mitglieder: Mitglied[]): Promise<void> {
    this.pruefeVerbunden();

    const datei: MitgliederDatei = { schemaVersion: SCHEMA_VERSION, mitglieder };
    pruefeMitgliederDatei(datei);

    await this.backupErstellen(MITGLIEDER_DATEI, MITGLIEDER_DATEI);
    await this.adapter.dateiSchreiben(MITGLIEDER_DATEI, JSON.stringify(datei, null, 2));
  }

  /**
   * Speichert ein Kegeljahr: validiert -> sichert bisherigen Stand als
   * Backup -> schreibt neue Version -> aktualisiert Manifest.
   */
  async kegeljahrSpeichern(kegeljahr: Kegeljahr, bekannteMitgliedIds?: Set<string>): Promise<void> {
    this.pruefeVerbunden();

    const datei: KegeljahrDatei = { schemaVersion: SCHEMA_VERSION, kegeljahr };
    // Wirft ValidierungsFehler, falls Daten inkonsistent sind — bricht VOR dem Schreiben ab.
    pruefeKegeljahrDatei(datei, bekannteMitgliedIds);

    const dateiname = dateinameFuerKegeljahr(kegeljahr.bezeichnung, `kegeljahr-${kegeljahr.id}`);
    const pfad = `kegeljahre/${dateiname}`;

    await this.backupErstellen(pfad, dateiname);
    await this.adapter.dateiSchreiben(pfad, JSON.stringify(datei, null, 2));
    await this.manifestAktualisieren(kegeljahr.id, kegeljahr.bezeichnung, dateiname);
  }

  private async backupErstellen(pfad: string, dateiname: string): Promise<void> {
    const bisherigerInhalt = await this.adapter.dateiLesen(pfad);
    if (bisherigerInhalt === null) return; // Erstes Speichern, kein Backup nötig

    const zeitstempel = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${dateiname.replace(/\.json$/, '')}_${zeitstempel}.json`;
    await this.adapter.dateiSchreiben(`backups/${backupName}`, bisherigerInhalt);
    await this.backupsRotieren(dateiname);
  }

  private async backupsRotieren(dateiname: string): Promise<void> {
    const praefix = dateiname.replace(/\.json$/, '');
    const alle = (await this.adapter.dateiListen('backups'))
      .filter((n) => n.startsWith(praefix))
      .sort(); // Zeitstempel im Namen -> alphabetisch == chronologisch

    const ueberzaehlige = alle.slice(0, Math.max(0, alle.length - MAX_BACKUPS_PRO_DATEI));
    for (const name of ueberzaehlige) {
      await this.adapter.dateiLoeschen(`backups/${name}`);
    }
  }

  private async manifestAktualisieren(
    id: string,
    bezeichnung: string,
    datei: string,
  ): Promise<void> {
    const manifest = await this.manifestSicherstellen();
    const bestehenderIndex = manifest.kegeljahre.findIndex((k) => k.id === id);
    const eintrag = { id, bezeichnung, datei };

    if (bestehenderIndex >= 0) manifest.kegeljahre[bestehenderIndex] = eintrag;
    else manifest.kegeljahre.push(eintrag);

    if (!manifest.aktuellesKegeljahrId) manifest.aktuellesKegeljahrId = id;

    await this.manifestSchreiben(manifest);
  }

  async aktuellesKegeljahrSetzen(id: string): Promise<void> {
    const manifest = await this.manifestSicherstellen();
    manifest.aktuellesKegeljahrId = id;
    await this.manifestSchreiben(manifest);
  }
}
