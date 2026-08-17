import { Service, inject } from '@angular/core';
import { KegeljahrStore } from './kegeljahr.store';
import { Mitglied } from './kegelverein.models';

/**
 * Mitgliederverwaltung: dünner CRUD-Wrapper um den Store.
 * Keine eigene Fachlogik nötig — bleibt hier bewusst simpel.
 */
@Service()
export class MitgliederService {
  private readonly store = inject(KegeljahrStore);

  readonly mitglieder = this.store.mitglieder;

  hinzufuegen(m: Mitglied): void {
    this.store.addMitglied(m);
  }

  aktualisieren(m: Mitglied): void {
    this.store.updateMitglied(m);
  }

  loeschen(id: string): void {
    this.store.deleteMitglied(id);
  }

  setzeAlle(mitglieder: Mitglied[]): void {
    this.store.setMitglieder(mitglieder);
  }

  suchen(id: string): Mitglied | undefined {
    return this.mitglieder().find(mitglieder => mitglieder.id === id);
  }
}
