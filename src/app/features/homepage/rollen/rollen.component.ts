import { Component, computed, inject, signal } from '@angular/core';
import { RolleMitRechten, RollenService } from '../../../core/rollen.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-rollen',
  imports: [JsonPipe],
  templateUrl: './rollen.component.html',
  styleUrl: './rollen.component.scss',
})
export class RollenComponent {
  private readonly rollenService = inject(RollenService);
  rollen = signal<RolleMitRechten[] | null>([]);

  constructor() {
    this.ladeRollen();
  }

  async ladeRollen() {
    this.rollen.set(await this.rollenService.rollenMitRechten('Kassenwart', 'masterpassword'));
  }
}
