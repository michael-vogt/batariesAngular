import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KegeltermineListeComponent } from './kegeltermine-liste.component';

describe('KegeltermineListeComponent', () => {
  let component: KegeltermineListeComponent;
  let fixture: ComponentFixture<KegeltermineListeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KegeltermineListeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(KegeltermineListeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
