import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { datumKurz } from '../../../shared/format.util';
import { RollenService } from '../../../core/rollen.service';
import { AnmeldungService } from '../../../core/anmeldung.service';

const STORE_KEY_LAST_USERNAME = "login_username";

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected username = signal<string>('Mitglied');
  protected readonly password = signal<string>('');
  protected readonly rollenService = inject(RollenService);
  protected readonly anmeldungService = inject(AnmeldungService);

  ngOnInit() {
    const user = localStorage.getItem(STORE_KEY_LAST_USERNAME);
    if (user) {
      this.username.set(user);
    }
  }

  protected async login(): Promise<void> {
    const username = this.username();
    const password = this.password();

    await this.anmeldungService.anmelden(username, password);

    this.password.set('');
    if (!this.anmeldungService.fehler()) {
      localStorage.setItem(STORE_KEY_LAST_USERNAME, this.username());
    }
  }

  protected logout(): void {
    this.anmeldungService.abmelden();
  }

  protected readonly datumKurz = datumKurz;
}
