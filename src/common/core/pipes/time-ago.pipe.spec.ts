/*
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève. All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 */

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TimeAgoPipe } from './time-ago.pipe';

@Component({
    template: `<span [innerText]="now2"></span>`,
})
class DejaTimeAgoTestComponent {

    // @Input()
    // public set date(value: Date) {
    //     if (value) {
    //         this.now = value;
    //     }
    // }

    public now2 = '(new Date()).toISOString()';

    constructor() {

    }
}

describe('DejaTimeAgoPipe', () => {
    let comp: DejaTimeAgoTestComponent;
    let fixture: ComponentFixture<DejaTimeAgoTestComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [
                DejaTimeAgoTestComponent,
                TimeAgoPipe,
            ],
            imports: [
              BrowserAnimationsModule,
                CommonModule,
                FormsModule,
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DejaTimeAgoTestComponent);
        comp = fixture.componentInstance;
    }));

    fit('should create the instance', () => {
        expect(comp).toBeTruthy();
    });

    fit('should show a date',  async(() => {
        // comp.date = new Date();
        // fixture.detectChanges();
        expect(comp).toBeTruthy();
        // const pipe = new TimeAgoPipe({markForCheck: () => {}} as any, new NgZone({}));
        // pipe.transform(comp.now, true);
    }));
});
