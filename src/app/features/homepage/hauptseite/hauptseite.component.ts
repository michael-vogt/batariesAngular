import { Component } from '@angular/core';
import { LoginComponent } from '../login/login.component';
import { KegeltermineListeComponent } from '../kegeltermine-liste/kegeltermine-liste.component';

@Component({
  selector: 'app-hauptseite',
  imports: [LoginComponent, KegeltermineListeComponent],
  templateUrl: './hauptseite.component.html',
  styleUrl: './hauptseite.component.scss',
})
export class HauptseiteComponent {}
