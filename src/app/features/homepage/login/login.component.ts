import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KegeljahrStore } from '../../../core/kegelverein/kegeljahr.store';
import { datumKurz } from '../../../shared/format.util';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { AbmeldungenComponent } from '../abmeldungen/abmeldungen.component';
import { RollenService } from '../../../core/rollen.service';
import { LoginService } from '../../../core/login-service';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [FormsModule, AbmeldungenComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected username = signal<string>('Mitglied');
  protected readonly password = signal<string>('');
  protected readonly terminService = inject(TerminService);
  protected readonly rollenService = inject(RollenService);
  protected readonly loginService = inject(LoginService);

  protected async login(): Promise<void> {
    const username = this.username();
    const password = this.password();

    await this.loginService.login(username, password);
    this.password.set('');
  }

  protected logout(): void {
    this.loginService.logout();
  }

  protected readonly datumKurz = datumKurz;
}
