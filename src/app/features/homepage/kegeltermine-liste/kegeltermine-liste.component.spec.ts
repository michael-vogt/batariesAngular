import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KegeltermineListeComponent } from './kegeltermine-liste.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { providePersistenz } from '../../../core/kegelverein/persistenz/persistenz.providers';

describe('KegeltermineListeComponent', () => {
  let component: KegeltermineListeComponent;
  let fixture: ComponentFixture<KegeltermineListeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KegeltermineListeComponent],
      providers: [provideRouter([]), provideHttpClient(), providePersistenz()],
    }).compileComponents();

    fixture = TestBed.createComponent(KegeltermineListeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
