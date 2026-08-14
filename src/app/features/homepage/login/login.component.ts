import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/user.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected readonly password = signal<string>('');
  protected readonly userService = inject(UserService);

  protected login(): void {
    const password = this.password();
    const role = this.userService.nutzerAnmelden(password);
    console.log(role);
    this.password.set('');
  }

  protected logout(): void {
    this.userService.nutzerAbmelden();
  }

}
