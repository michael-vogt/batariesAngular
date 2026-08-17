import { inject, Service, signal } from '@angular/core';
import { Berechtigungen, RollenService } from './rollen.service';

interface Nutzer {
  username: string;
  berechtigungen: Berechtigungen;
}

@Service()
export class LoginService {

  private readonly rollenService = inject(RollenService);
  private readonly _currentNutzer = signal<Nutzer | null>(null);
  private readonly _fehler = signal<string | null>(null);

  readonly currentNutzer = this._currentNutzer.asReadonly();
  readonly fehler = signal<string | null>(null);

  hatBerechtigung(attribut: string): boolean {
    if (!this._currentNutzer)
      return false;

    const berechtigungen = this._currentNutzer()?.berechtigungen;
    if (!berechtigungen)
      return false;

    if (attribut in berechtigungen) {
      return berechtigungen[attribut as keyof Berechtigungen];
    }

    return false;
  }

  istNutzerAngemeldet(): boolean {
    return this.currentNutzer() !== null;
  }

  async login(username: string, password: string): Promise<void> {
    const erg = await this.rollenService.pruefe(username, password);
    if (erg.gueltig) {
      this._currentNutzer.set({ username: erg.name, berechtigungen: erg.berechtigungen });
      this._fehler.set(null);
    } else {
      this._fehler.set(erg.meldung);
    }
  }

  logout(): void {
    this._currentNutzer.set(null);
    this._fehler.set(null);
  }

}
