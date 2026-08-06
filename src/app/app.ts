import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FileStorageService } from './core/kegelverein/persistenz/file-storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('bataries');

  private readonly storage = inject(FileStorageService);

  async ngOnInit(): Promise<void> {
    // Reaktiviert stillschweigend die zuletzt gespeicherten Zugangsdaten.
    // Schlägt das fehl, zeigt das Verbindungsformular seinen Status an.
    await this.storage.automatischVerbinden();
  }
}
