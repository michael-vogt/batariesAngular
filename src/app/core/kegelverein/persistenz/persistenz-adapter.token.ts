import { InjectionToken } from '@angular/core';
import { PersistenzAdapter } from './persistenz-adapter';

/**
 * Austauschpunkt für den Persistenz-Adapter. In app.config.ts registrieren:
 *
 *   { provide: PERSISTENZ_ADAPTER, useExisting: PhpApiAdapter }
 *
 * FileStorageService kennt nur diesen Token, nie eine konkrete Klasse —
 * in Tests lässt sich hier ein In-Memory-Fake einsetzen.
 */
export const PERSISTENZ_ADAPTER = new InjectionToken<PersistenzAdapter>('PERSISTENZ_ADAPTER');
