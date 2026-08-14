import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbmeldungenComponent } from './abmeldungen.component';

describe('AbmeldungenComponent', () => {
  let component: AbmeldungenComponent;
  let fixture: ComponentFixture<AbmeldungenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbmeldungenComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AbmeldungenComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
