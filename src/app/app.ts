import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FileStorageService } from './core/kegelverein/persistenz/file-storage.service';
import { VereinsdatenService } from './core/kegelverein/vereinsdaten.service';
import { HauptnavigationComponent } from './features/hauptnavigation/hauptnavigation.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HauptnavigationComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('bataries');

  private readonly storage = inject(FileStorageService);
  private readonly daten = inject(VereinsdatenService);

  async ngOnInit(): Promise<void> {
    const verbunden = await this.storage.automatischVerbinden();
    if (verbunden) await this.daten.initialisieren();
  }
}
