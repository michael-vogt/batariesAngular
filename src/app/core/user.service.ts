import { Service, signal } from '@angular/core';

export type Role = 'user' | 'admin' | '';

const SPEICHER_SCHLUESSEL = 'nutzer-rolle'

@Service()
export class UserService {

  private readonly _currentRole = signal<Role>('');
  private readonly _fehler = signal<string | null>(null);

  readonly currentRole = this._currentRole.asReadonly();
  readonly fehler = this._fehler.asReadonly();

  istAdminAngemeldet(): boolean {
    return this._currentRole() === 'admin';
  }

  istNutzerAngemeldet(): boolean {
    return this._currentRole() !== '';
  }

  nutzerAnmelden(password: string): Role {
    this._fehler.set(null);
    if (password === 'masterpassword' || password === 'admin') {
      this._currentRole.set('admin');
    } else if (password === 'userpw') {
      this._currentRole.set('user');
    } else {
      this._fehler.set('Falsches Passwort!');
      this._currentRole.set('');
    }

    return this._currentRole();
  }

  nutzerAbmelden(): void {
    this._fehler.set(null);
    if (this._currentRole() !== '') {
      this._currentRole.set('');
    }
  }

}
