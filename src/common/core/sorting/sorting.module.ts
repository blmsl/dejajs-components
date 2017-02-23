/*
 * *
 *  @license
 *  Copyright Hôpital Universitaire de Genève All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/deja-js/blob/master/LICENSE
 * /
 *
 */

import { NgModule } from "@angular/core";
import { DejaSortIndicatorComponent, SortingService} from "./index";

@NgModule({
    declarations: [DejaSortIndicatorComponent],
    exports: [DejaSortIndicatorComponent],
    providers: [SortingService],
})
export class DejaSortingModule { }