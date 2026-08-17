import { Routes } from '@angular/router';
import { LegacyImportComponent } from './features/verwaltung/import/legacy-import.component';
import { MitgliederListeComponent } from './features/verwaltung/mitglieder/mitglieder-liste.component';
import { KegelabendListeComponent } from './features/verwaltung/kegelabend/kegelabend-liste.component';
import { KegelabendDetailComponent } from './features/verwaltung/kegelabend/kegelabend-detail.component';
import { BuchungenJournalComponent } from './features/verwaltung/buchfuehrung/buchungen-journal.component';
import { KontenUebersichtComponent } from './features/verwaltung/buchfuehrung/konten-uebersicht.component';
import { GeschaeftsvorfaelleComponent } from './features/verwaltung/buchfuehrung/geschaeftsvorfaelle.component';
import { JahresabschlussComponent } from './features/verwaltung/buchfuehrung/jahresabschluss.component';
import { HauptnavigationComponent } from './features/verwaltung/hauptnavigation/hauptnavigation.component';
import { AnleitungComponent } from './features/verwaltung/anleitung/anleitung.component';
import { BackupWiederherstellungComponent } from './features/verwaltung/import/backup-wiederherstellung.component';
import { VerbindungEinstellungenComponent } from './features/verwaltung/einstellungen/verbindung-einstellungen.component';
import { RahmenComponent } from './features/homepage/rahmen/rahmen.component';
import { VerwaltungComponent } from './features/verwaltung/verwaltung.component';
import { MarkdownViewerComponent } from './shared/markdown-viewer/markdown-viewer.component';
import { LoginComponent } from './features/homepage/login/login.component';
import { TermineComponent } from './features/homepage/termine/termine.component';
import { RollenComponent } from './features/homepage/rollen/rollen.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/homepage/home',
    pathMatch: 'full',
  },
  {
    path: 'homepage',
    component: RahmenComponent,
    children: [
      {
        path: 'home',
        component: LoginComponent,
      },
      {
        path: 'dokument/:seite',
        component: MarkdownViewerComponent,
      },
      {
        path: 'kegeltermine',
        component: TermineComponent
      },
      {
        path: 'rollen',
        component: RollenComponent,
      },

      {
        path: 'verwaltung',
        component: VerwaltungComponent,
        children: [
          {
            path: '',
            redirectTo: 'mitglieder',
            pathMatch: 'full',
          },
          {
            path: 'anleitung',
            loadComponent: () =>
              import('./features/verwaltung/anleitung/anleitung.component').then(
                (m) => m.AnleitungComponent,
              ),
          },
          {
            path: 'abrechnung',
            loadComponent: () =>
              import('./features/verwaltung/abrechnung/abrechnung.component').then(
                (m) => m.AbrechnungComponent,
              ),
          },
          {
            path: 'buchfuehrung/journal',
            component: BuchungenJournalComponent,
          },
          {
            path: 'buchfuehrung/konten',
            component: KontenUebersichtComponent,
          },
          {
            path: 'buchfuehrung/vorfaelle',
            component: GeschaeftsvorfaelleComponent,
          },
          {
            path: 'buchfuehrung/abschluss',
            component: JahresabschlussComponent,
          },
          {
            path: 'kegelabende',
            component: KegelabendListeComponent,
          },
          {
            path: 'kegelabende/:id',
            loadComponent: () =>
              import('./features/verwaltung/kegelabend/kegelabend-detail.component').then(
                (m) => m.KegelabendDetailComponent,
              ),
          },
          {
            path: 'mitglieder',
            component: MitgliederListeComponent,
          },
          {
            path: 'sicherungen',
            component: BackupWiederherstellungComponent,
          },
          {
            path: 'import',
            component: LegacyImportComponent,
          },
          {
            path: 'einstellungen',
            component: VerbindungEinstellungenComponent,
          },
        ],
      },
    ],
  },
];
