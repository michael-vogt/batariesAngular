import { Service, signal } from '@angular/core';

export type Role = 'user' | 'admin' | undefined;

const SPEICHER_SCHLUESSEL = 'nutzer-rolle'

@Service()
export class UserService {

  private readonly _currentRole = signal<Role>(undefined);
  private readonly _fehler = signal<string | null>(null);

  readonly currentRole = this._currentRole.asReadonly();
  readonly fehler = this._fehler.asReadonly();

  istNutzerAngemeldet(): boolean {
    return this._currentRole() !== undefined;
  }

  nutzerAnmelden(password: string): Role {
    this._fehler.set(null);
    if (password === 'masterpassword') {
      this._currentRole.set('admin');
      return 'admin';
    } else if (password === 'userpw') {
      this._currentRole.set('user');
      return 'user';
    }

    this._fehler.set('Falsches Passwort!');
    this._currentRole.set(undefined);
    return undefined;
  }

  nutzerAbmelden(): void {
    this._fehler.set(null);
    if (this._currentRole() !== undefined) {
      this._currentRole.set(undefined);
    }
  }

}
