/*
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève. All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 */

export * from './common/index';
export * from './component/index';

if (!document.doctype) {
    console.warn('[DejaJS] Current document does not have a doctype. This may cause some components not to behave as expected.');
}
