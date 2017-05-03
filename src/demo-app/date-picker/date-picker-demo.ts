/*
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève. All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 */

import { Component, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs/Rx';
import { DejaDatePickerComponent } from '../../index';

@Component({
    selector: 'dejadate-picker-demo',
    templateUrl: './date-picker-demo.html',
})
export class DejaDatePickerDemoComponent implements OnInit {
    protected tabIndex = 1;

    public theDate = new Date();
    public disabledDate = [0, 6, new Date(2016, 9, 12)];

    public dateRangeFrom: Date;
    public dateRangeTo: Date;
    
    private dateFrom = new BehaviorSubject(undefined);
    private dateTo = new BehaviorSubject(undefined);

    constructor() {
        let debouceTime = 0;

        const dateFrom$ = Observable.from(this.dateFrom)
            .distinctUntilChanged((date1, date2) => {
                return (date1 && date1.getTime()) === (date2 && date2.getTime());
            });

        const dateTo$ = Observable.from(this.dateTo)
            .distinctUntilChanged((date1, date2) => {
                return (date1 && date1.getTime()) === (date2 && date2.getTime());
            });

        Observable.combineLatest(dateFrom$, dateTo$)
            .debounceTime(debouceTime)
            .map(([date1, date2]) => date1 && date2 && date1.getTime() > date2.getTime() ? [date2, date1] : [date1, date2])
            .subscribe(([]) => {
                // Value 1 et value2 dispo ici dans l'ordre
                debouceTime = 500;
            });
    }

    public ngOnInit() { }
}
