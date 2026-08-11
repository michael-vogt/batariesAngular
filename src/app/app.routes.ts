import { Routes } from '@angular/router';
import { LegacyImportComponent } from './features/import/legacy-import.component';
import { MitgliederListeComponent } from './features/mitglieder/mitglieder-liste.component';
import { KegelabendListeComponent } from './features/kegelabend/kegelabend-liste.component';
import { KegelabendDetailComponent } from './features/kegelabend/kegelabend-detail.component';
import { BuchungenJournalComponent } from './features/buchfuehrung/buchungen-journal.component';
import { KontenUebersichtComponent } from './features/buchfuehrung/konten-uebersicht.component';
import { GeschaeftsvorfaelleComponent } from './features/buchfuehrung/geschaeftsvorfaelle.component';
import { JahresabschlussComponent } from './features/buchfuehrung/jahresabschluss.component';
import { HauptnavigationComponent } from './features/hauptnavigation/hauptnavigation.component';
import { AnleitungComponent } from './features/anleitung/anleitung.component';
import { BackupWiederherstellungComponent } from './features/import/backup-wiederherstellung.component';
import { VerbindungEinstellungenComponent } from './features/einstellungen/verbindung-einstellungen.component';

export const routes: Routes = [
  {
    path: 'anleitung',
    component: AnleitungComponent
  },
  {
    path: 'abrechnung',
    loadComponent: () =>
      import('./features/abrechnung/abrechnung.component')
        .then(m => m.AbrechnungComponent)
  },
  {
    path: '',
    redirectTo: 'mitglieder',
    pathMatch: 'full'
  },
  {
    path: 'buchfuehrung/journal',
    component: BuchungenJournalComponent
  },
  {
    path: 'buchfuehrung/konten',
    component: KontenUebersichtComponent
  },
  {
    path: 'buchfuehrung/vorfaelle',
    component: GeschaeftsvorfaelleComponent
  },
  {
    path: 'buchfuehrung/abschluss',
    component: JahresabschlussComponent
  },
  {
    path: 'kegelabende',
    component: KegelabendListeComponent
  },
  {
    path: 'kegelabende/:id',
    component: KegelabendDetailComponent
  },
  {
    path: 'mitglieder',
    component: MitgliederListeComponent
  },
  {
    path: 'sicherungen',
    component: BackupWiederherstellungComponent
  },
  {
    path: 'import',
    component: LegacyImportComponent
  },
  {
    path: 'einstellungen',
    component: VerbindungEinstellungenComponent
  }
];
