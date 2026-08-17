import { Component, inject } from '@angular/core';
import { LoginComponent } from '../login/login.component';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LoginService } from '../../../core/login-service';

@Component({
  selector: 'app-rahmen',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './rahmen.component.html',
  styleUrl: './rahmen.component.scss',
})
export class RahmenComponent {
  protected loginService = inject(LoginService);
}
