import { Provider } from '@angular/core';
import { PERSISTENZ_ADAPTER } from './persistenz-adapter.token';
import { PhpApiAdapter } from './php-api-adapter';

/**
 * Verdrahtet die Persistenzschicht.
 *
 * Steht hier und nicht direkt in app.config.ts, damit Tests dieselbe
 * Verdrahtung verwenden können. Ohne diesen gemeinsamen Ort müsste jede
 * Testdatei die Zuordnung wiederholen — und würde sie beim nächsten
 * Wechsel des Adapters vergessen.
 *
 * Verwendung:
 *   app.config.ts   providers: [ …, providePersistenz() ]
 *   Testdatei       providers: [ provideHttpClient(), providePersistenz() ]
 */
export function providePersistenz(): Provider[] {
  return [{ provide: PERSISTENZ_ADAPTER, useExisting: PhpApiAdapter }];
}
