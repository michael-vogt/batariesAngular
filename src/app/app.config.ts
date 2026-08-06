import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { PERSISTENZ_ADAPTER } from './core/kegelverein/persistenz/persistenz-adapter.token';
import { PhpApiAdapter } from './core/kegelverein/persistenz/php-api-adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    {
      provide: PERSISTENZ_ADAPTER, useExisting: PhpApiAdapter
    }
  ]
};
