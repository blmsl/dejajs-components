/*
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève. All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 */

import 'rxjs/add/observable/of';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/reduce';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/toPromise';
import { Observable } from 'rxjs/Observable';
import { ISortInfos } from './sort-infos.model';
import { SortOrder } from './sort-order.model';

/** Classe de tri d'une liste plate ou hierarchique */
export class SortingService {
    /** Fonction de comparaison de deux objets
     * @param a Objet 1.
     * @param b Objet 2.
     * @param sortInfos Modèle de tri à appliquer pour la comparaison.
     * @return 0 si les objet sont égaux, 1 si b est après a, -1 si a après b
     */
    public static compare(a: any, b: any, sortInfo: ISortInfos) {
        const orderfact = sortInfo.order === SortOrder.ascending ? 1 : -1;

        // tslint:disable-next-line:triple-equals
        if (a == undefined && b == undefined) {
            return 0;
        }

        // tslint:disable-next-line:triple-equals
        if (a == undefined) {
            return -orderfact;
        }

        // tslint:disable-next-line:triple-equals
        if (b == undefined) {
            return orderfact;
        }

        const sortnamea = a.sortField || (typeof sortInfo.name === 'function' ? sortInfo.name(a) : sortInfo.name);
        const sortnameb = b.sortField || (typeof sortInfo.name === 'function' ? sortInfo.name(b) : sortInfo.name);

        let flda = sortnamea ? a[sortnamea] : a;
        let fldb = sortnameb ? b[sortnameb] : b;

        // tslint:disable-next-line:triple-equals
        if (flda == undefined && fldb == undefined) {
            return 0;
        }

        // tslint:disable-next-line:triple-equals
        if (flda == undefined) {
            return -orderfact;
        }

        // tslint:disable-next-line:triple-equals
        if (fldb == undefined) {
            return orderfact;
        }

        let typea = sortInfo.type || typeof flda;
        let typeb = sortInfo.type || typeof fldb;

        if (typea === 'function') {
            flda = flda();
            typea = typeof flda;
        }

        if (typeb === 'function') {
            fldb = fldb();
            typeb = typeof fldb;
        }

        if (typea === typeb) {
            if (typea === 'number') {
                return orderfact * (flda - fldb);
            } else if (typea === 'date') {
                // If the type is specified on the sortInfo
                return orderfact * (flda.getTime() - fldb.getTime());
            } else if (typea === 'object') {
                typea = flda.constructor.name;
                typeb = fldb.constructor.name;

                if (typea === typeb) {
                    switch (typea) {
                        case 'Date':
                            return orderfact * (flda.getTime() - fldb.getTime());
                        default:
                            break;
                    }
                }
            } else {
                // for other types, write your code here
            }
        }

        if (!flda) {
            flda = '';
        }

        if (!fldb) {
            fldb = '';
        }

        const stra = flda.toString() as string;
        const strb = fldb.toString() as string;
        return orderfact * stra.localeCompare(strb);
    }

    /** Trie les éléments de la liste plate spécifiée en fonction du modèle de tri spécifié
     * @param list Liste à trier.
     * @param sortInfos Modèle de tri à appliquer.
     * @return Observable résolu par la fonction.
     */
    public sort$(list: any[], sortInfo: ISortInfos | ISortInfos[]) {
        return Observable.of(sortInfo)
            .map((si) => sortInfo instanceof Array ? si : [si])
            .map((sortInfos: ISortInfos[]) => {
                const compareFn = (a: any, b: any) => {
                    let i = -1;
                    let result = 0;
                    while (++i < sortInfos.length && result === 0) {
                        result = SortingService.compare(a, b, sortInfos[i]);
                    }
                    return result;
                };
                return list.sort(compareFn);
            });
    }

    /**
     * @deprecated > 06.11.2017
     */
    public sort(list: any[], sortInfo: ISortInfos | ISortInfos[]) {
        return this.sort$(list, sortInfo).toPromise();
    }

    /** Trie les éléments de la liste hierarchique spécifiée en fonction du modèle de tri spécifié
     * @param tree Liste à trier.
     * @param sortInfos Modèle de tri à appliquer.
     * @param childrenField Champ à utiliser pour la recherche dans les enfants d'un parent.
     * @return Observable résolue par la fonction.
     */
    public sortTree$(tree: any[], sortInfo: ISortInfos | ISortInfos[], childrenField?: string) {
        childrenField = childrenField || 'items';
        return this.sort$(tree, sortInfo)
            .switchMap((child) => child)
            .flatMap((child) => {
                if (!child || !child[childrenField]) {
                    return Observable.of(child);
                }
                return this.sortTree$(child[childrenField], sortInfo, childrenField)
                    .map((sortedList) => {
                        child[childrenField] = sortedList;
                        return child;
                    });
            })
            .reduce((acc: any[], cur) => {
                acc.push(cur);
                return acc;
            }, []);
    }

    /**
     * @deprecated > 06.11.2017
     */
    public sortTree(tree: any[], sortInfo: ISortInfos | ISortInfos[], childrenField?: string) {
        return this.sortTree$(tree, sortInfo, childrenField).toPromise();
    }
}
