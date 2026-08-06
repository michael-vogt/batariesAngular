import { Routes } from '@angular/router';
import { LegacyImportComponent } from './features/import/legacy-import.component';
import { MitgliederListeComponent } from './features/mitglieder/mitglieder-liste.component';

export const routes: Routes = [
  {
    path: 'mitglieder',
    component: MitgliederListeComponent
  },
  {
    path: 'import',
    component: LegacyImportComponent
  },
  {
    path: 'einstellungen',
    loadComponent: () =>
      import('./features/einstellungen/verbindung-einstellungen.component')
        .then(m => m.VerbindungEinstellungenComponent),
  },
  {
    path: '',
    redirectTo: 'einstellungen',
    pathMatch: 'full'
  }
];
