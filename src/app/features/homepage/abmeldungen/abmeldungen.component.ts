import { Component, computed, effect, inject } from '@angular/core';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { Abmeldung, Kegeltermin } from '../../../core/kegelverein/kegelverein.models';
import { datumKurz, datumZeitKurz } from '../../../shared/format.util';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';

@Component({
  selector: 'app-abmeldungen',
  imports: [],
  templateUrl: './abmeldungen.component.html',
  styleUrl: './abmeldungen.component.scss',
})
export class AbmeldungenComponent {

  private readonly terminService = inject(TerminService);
  protected readonly mitgliederService = inject(MitgliederService);

  constructor() {
    this.terminService.laden();
  }

  protected readonly naechsterTermin = computed<Kegeltermin | null>(() => {
    return this.terminService.naechsterTermin();
  });

  protected readonly abmeldungen = computed<Abmeldung[]>(() => {
    const naechsterTermin = this.terminService.naechsterTermin();
    if (!naechsterTermin) {
      return [];
    }

    return naechsterTermin.abmeldungen;
  });

  protected readonly datumKurz = datumKurz;
  protected readonly datumZeitKurz = datumZeitKurz;
}
