import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/user.service';
import { KegeljahrStore } from '../../../core/kegelverein/kegeljahr.store';
import { datumKurz } from '../../../shared/format.util';
import { TerminService } from '../../../core/kegelverein/termin.service';
import { AbmeldungenComponent } from '../abmeldungen/abmeldungen.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, AbmeldungenComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected readonly password = signal<string>('');
  protected readonly userService = inject(UserService);
  protected readonly terminService = inject(TerminService);

  protected login(): void {
    const password = this.password();
    const role = this.userService.nutzerAnmelden(password);
    this.password.set('');
  }

  protected logout(): void {
    this.userService.nutzerAbmelden();
  }

  protected readonly datumKurz = datumKurz;
}
