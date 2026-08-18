import { Component, computed, inject, signal } from '@angular/core';
import {
  Berechtigungen,
  BERECHTIGUNGSLISTE,
  KEINE_BERECHTIGUNGEN,
  RolleMitRechten,
  RollenService,
} from '../../../core/rollen.service';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rollen',
  templateUrl: './rollen.component.html',
  styleUrl: './rollen.component.scss',
  imports: [FormsModule],
})
export class RollenComponent {
  protected readonly rollenService = inject(RollenService);
  protected readonly berechtigungsliste = BERECHTIGUNGSLISTE;
  rollen = signal<RolleMitRechten[] | null>([]);

  constructor() {
    this.ladeRollen();
  }

  async ladeRollen() {
    this.rollen.set(await this.rollenService.rollenMitRechten('Kassenwart', 'masterpassword'));
  }

  // Eigene Zugangsdaten — jeder schreibende Aufruf weist sich neu aus,
  // weil es keine Sitzung gibt.
  protected readonly eigenerName = signal('');
  protected readonly eigenesPasswort = signal('');

  protected readonly neuName = signal('');
  protected readonly neuPasswort = signal('');
  protected readonly neuRechte = signal<Berechtigungen>({ ...KEINE_BERECHTIGUNGEN });
  protected readonly legtAn = signal(false);
  protected readonly anlegeFehler = signal<string | null>(null);
  protected readonly anlegeMeldung = signal<string | null>(null);

  protected rechtUmschalten(recht: keyof Berechtigungen): void {
    this.neuRechte.update((r) => ({ ...r, [recht]: !r[recht] }));
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
    } else {
      this.anlegeFehler.set(ergebnis.meldung);
    }

    this.legtAn.set(false);
  }
}
