import { Component, inject } from '@angular/core';
import { LoginComponent } from '../login/login.component';
import { UserService } from '../../../core/user.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-rahmen',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './rahmen.component.html',
  styleUrl: './rahmen.component.scss',
})
export class RahmenComponent {
  protected userService = inject(UserService);
}
