import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HauptseiteComponent } from './hauptseite.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { providePersistenz } from '../../../core/kegelverein/persistenz/persistenz.providers';

describe('HauptseiteComponent', () => {
  let component: HauptseiteComponent;
  let fixture: ComponentFixture<HauptseiteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HauptseiteComponent],
      providers: [provideRouter([]), provideHttpClient(), providePersistenz()]
    }).compileComponents();

    fixture = TestBed.createComponent(HauptseiteComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
