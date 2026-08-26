import { Component, computed, inject, input } from '@angular/core';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { erzeugeUebersicht } from '../../../core/kegelverein/termin.logic';
import { MitgliederService } from '../../../core/kegelverein/mitglieder.service';
import { datumKurz, datumZeitKurz, datumZeitLang } from '../../../shared/format.util';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';

export type KegelterminAnzeigeModus = 'alle' | 'nur_naechster';

@Component({
  selector: 'app-kegeltermine-liste',
  imports: [FormsModule],
  templateUrl: './kegeltermine-liste.component.html',
  styleUrl: './kegeltermine-liste.component.scss',
})
export class KegeltermineListeComponent {
  protected readonly terminService = inject(TerminService);
  protected readonly mitgliederService = inject(MitgliederService);

  private readonly route = inject(ActivatedRoute);

  readonly modusInput = input<KegelterminAnzeigeModus | undefined>(undefined);

  readonly modusRoute = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const modus = params.get('modus');
        return modus === 'alle' || modus === 'nur_naechster' ? modus : 'nur_naechster';
      }),
    ),
    { initialValue: 'nur_naechster' as KegelterminAnzeigeModus },
  );

  readonly modus = computed<KegelterminAnzeigeModus>(
    () => this.modusInput() ?? this.modusRoute() ?? 'nur_naechster'
  );

  protected readonly uebersichten = computed(() => {
    const termine = this.terminService
      .termine()
      .map((t) => erzeugeUebersicht(t, this.mitgliederService.mitglieder(), null));
    return this.modus() === 'alle' ? termine : termine.slice(0, 1);
  });

  protected readonly datumZeitKurz = datumZeitKurz;
  protected readonly datumKurz = datumKurz;
}
