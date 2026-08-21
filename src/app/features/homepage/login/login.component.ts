import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { datumKurz } from '../../../shared/format.util';
import { RollenService } from '../../../core/rollen.service';
import { LoginService } from '../../../core/login-service';

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
  protected readonly loginService = inject(LoginService);

  ngOnInit() {
    const user = localStorage.getItem(STORE_KEY_LAST_USERNAME);
    if (user) {
      this.username.set(user);
    }
  }

  protected async login(): Promise<void> {
    const username = this.username();
    const password = this.password();

    await this.loginService.login(username, password);
    this.password.set('');
    if (!this.loginService.fehler()) {
      localStorage.setItem(STORE_KEY_LAST_USERNAME, this.username());
    }
  }

  protected logout(): void {
    this.loginService.logout();
  }

  protected readonly datumKurz = datumKurz;
}
