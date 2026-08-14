import { Component, inject } from '@angular/core';
import { LoginComponent } from '../login/login.component';
import { UserService } from '../../../core/user.service';

@Component({
  selector: 'app-rahmen',
  imports: [LoginComponent],
  templateUrl: './rahmen.component.html',
  styleUrl: './rahmen.component.scss',
})
export class RahmenComponent {

  protected userService = inject(UserService);

}
