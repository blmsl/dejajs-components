/*
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève. All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 */

import { coerceNumberProperty } from '@angular/cdk/coercion';
import { ChangeDetectorRef, EventEmitter, OnDestroy } from '@angular/core';
import 'rxjs/add/observable/from';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/reduce';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeWhile';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { IGroupInfo } from '../grouping/group-infos';
import { GroupingService } from '../grouping/grouping.service';
import { ISortInfos } from '../sorting/sort-infos.model';
import { SortOrder } from '../sorting/sort-order.model';
import { SortingService } from '../sorting/sorting.service';
import { IItemBase } from './item-base';
import { IFindItemResult, IParentListInfoResult, ItemListService, IViewListResult } from './item-list.service';
import { IItemTree } from './item-tree';
import { IViewPort, IViewPortRefreshParams, ViewportMode, ViewPortService } from './viewport.service';

const noop = () => { };

/** Classe de base pour tous les composants à listes (deja-treelist, deja-select, deja-grid) */
export abstract class ItemListBase implements OnDestroy {
    protected _waiter = true;

    protected _itemList: IItemBase[] = []; // Viewport list
    protected _multiSelect = false;
    protected _searchField: string;
    protected _maxHeight: number;
    protected _currentItemIndex = -1;
    protected _currentItem: IItemBase;
    protected _hintLabel: string;
    protected _nodataLabel: string;
    protected _hideSelected: boolean;
    protected _childrenField: string;
    protected _minSearchLength = 0;
    protected _listElementId: string;
    protected _isAlive = true;

    // Viewport
    protected _vpBeforeHeight = 0;
    protected _vpAfterHeight = 0;
    protected _vpStartRow = 0;
    protected _vpEndRow = 0;
    protected _pageSize = 0;
    protected _depthMax = 0;
    protected rowsCount = 0;

    // Sorting
    protected _sortInfos: ISortInfos;

    protected _viewPortChanged: EventEmitter<IViewPort>;

    // Drag drop
    protected _ddStartIndex: number;
    protected _ddTargetIndex: number;

    private _textField: string;
    private _valueField: string;

    private waiter$sub: Subscription;

    private _itemListService: ItemListService;
    private allCollapsed = false;
    private _viewPortRowHeight = ViewPortService.itemDefaultSize;

    private _listElement: HTMLElement;

    constructor(protected changeDetectorRef: ChangeDetectorRef, protected viewPort: ViewPortService) {

        this._listElementId = `listcontainer_${(1000000000 * Math.random()).toString().substr(10)}`;

        viewPort.viewPort$
            .takeWhile(() => this._isAlive)
            .subscribe((viewPortResult: IViewPort) => {
                delete this._hintLabel;
                if (viewPort.mode === ViewportMode.disabled) {
                    this._itemList = viewPortResult.items;
                    this._vpStartRow = 0;
                    this._vpEndRow = 0;
                    this._vpBeforeHeight = 0;
                    this._vpAfterHeight = 0;
                } else {
                    this._itemList = viewPortResult.visibleItems;
                    this._vpStartRow = viewPortResult.startIndex;
                    this._vpEndRow = viewPortResult.endIndex;
                    this._vpBeforeHeight = viewPortResult.beforeSize;
                    this._vpAfterHeight = viewPortResult.afterSize;
                }

                if (viewPortResult.scrollPos !== undefined) {
                    if (this.listElement) {
                        const listItems = this.listElement.getElementsByClassName('listitem');
                        const rebind = listItems.length !== viewPortResult.visibleItems.length;
                        if (!rebind) {
                            this.listElement.scrollTop = viewPortResult.scrollPos;
                        } else {
                            Observable.timer(1)
                                .first()
                                .subscribe(() => {
                                    this.listElement.scrollTop = viewPortResult.scrollPos;
                                });
                        }
                    }
                }

                this.changeDetectorRef.markForCheck();
                // console.log(viewPortResult);

                if (this._viewPortChanged) {
                    this._viewPortChanged.next(viewPortResult);
                }
            });
    }

    public get isMultiSelect() {
        return this._multiSelect;
    }

    public get itemList() {
        return this._itemList;
    }

    public get ddStartIndex() {
        return this._ddStartIndex;
    }

    public get vpBeforeHeight() {
        return this._vpBeforeHeight;
    }

    public get vpAfterHeight() {
        return this._vpAfterHeight;
    }

    public get vpStartRow() {
        return this._vpStartRow;
    }

    public get vpEndRow() {
        return this._vpEndRow;
    }

    /** Renvoie le modèle de tri appliqué à la liste.
     * @param sortInfos Modèle de tri appliqué.
     */
    public get sortInfos() {
        return this._sortInfos;
    }

    /** Renvoie le modèle de regroupement appliqué à la liste.
     * @param sortInfos Modèle de regroupement appliqué.
     */
    public get groupInfos() {
        return this._itemListService.groupInfos;
    }

    public ngOnDestroy() {
        this._isAlive = false;
    }

    /** Définit une valeur indiquant si les éléments selectionés doivent être masqué. Ce flag est principalement utilisé dans le cas d'un multi-select
     * @param value True si les éléments selectionés doivent être masqués
     */
    public setHideSelected(value: boolean) {
        this._hideSelected = value;
        if (this._itemListService) {
            this._itemListService.hideSelected = value;
        }
    }

    /** Définit le champs utilisé comme collection pour les enfants d'un parent.
     * @param value Nom du champ à utiliser comme collection d'enfants
     */
    public setChildrenField(value: string) {
        this._childrenField = value;
        if (this._itemListService) {
            this._itemListService.childrenField = value;
        }
    }

    /** Renvoie l'index de l'élément sur la liste plate corespondant à l'élément HTML spécifié
     * @return Index sur la liste plate corespondant à l'élément HTML
     */
    public getItemIndexFromHTMLElement(element: HTMLElement): number {
        while (element && element.parentElement && element.hasAttribute && !element.hasAttribute('flat') && element.parentElement.id !== this.listElementId) {
            element = element.parentElement;
        }

        if (!element || !element.hasAttribute('flat')) {
            return undefined;
        }

        return +element.getAttribute('flat');
    }

    public getItemFromHTMLElement(element: HTMLElement): IItemBase {
        const itemIndex = this.getItemIndexFromHTMLElement(element);
        if (itemIndex === undefined) {
            return undefined;
        }

        return this._itemList[itemIndex - this.vpStartRow];
    }

    /** Retourne le service de liste utilisé par ce composant.
     * @return Service de liste utilisé par ce composant.
     */
    public getItemListService() {
        if (!this._itemListService) {
            this.setItemListService(new ItemListService());
        }
        return this._itemListService;
    }

    /** Retourne la liste des éléments sélectionés.
     * @return Liste des éléments selectionés.
     */
    public getSelectedItems() {
        return this.getItemListService().getSelectedItems();
    }

    /** Définit la liste des éléments sélectionés.
     * @param items Liste des éléments a selectioner.
     */
    public setSelectedItems(value: IItemBase[]) {
        this.getItemListService().setSelectedItems(value);
        this.changeDetectorRef.markForCheck();
    }

    /**
     * Set a promise or an observable called before an item selection
     */
    public setLoadingItems(fn: (query: string | RegExp, selectedItems: IItemBase[]) => Observable<IItemBase[]>) {
        this.getItemListService().setLoadingItems(fn);
    }

    /**
     * Set a promise or an observable called before an item deselection
     */
    public setSelectingItem(fn: (item: IItemBase) => Promise<IItemBase> | Observable<IItemBase>) {
        this.getItemListService().setSelectingItem(fn);
    }

    /**
     * Set a promise or an observable called before an item deselection
     */
    public setUnselectingItem(fn: (item: IItemBase) => Promise<IItemBase> | Observable<IItemBase>) {
        this.getItemListService().setUnselectingItem(fn);
    }

    /**
     * Set a promise or an observable called before an item selection
     */
    public setExpandingItem(fn: (item: IItemTree) => Promise<IItemTree> | Observable<IItemTree>) {
        this.getItemListService().setExpandingItem(fn);
    }

    /**
     * Set a promise or an observable called before an item deselection
     */
    public setCollapsingItem(fn: (item: IItemTree) => Promise<IItemTree> | Observable<IItemTree>) {
        this.getItemListService().setCollapsingItem(fn);
    }

    /** Evalue le texte à afficher pour l'élément spécifié.
     * @param value  Model à évaluer.
     * @return Texte à afficher pour le modèle spécifié.
     */
    public getTextValue(value: any) {
        return this.getItemListService().getTextValue(value, this._textField);
    }

    /**
     * Set le viewport mode
     *
     * @param mode Mode du viewport (sans viewport, avec un viewport tailles des rows fixes ou dynamiques)
     */
    public setViewportMode(mode: ViewportMode | string) {
        this.viewPort.mode$.next(mode);
    }

    /** Trie la liste par le champs spécifié. */
    public sort(name?: string) {
        this.sort$(name).first().subscribe(noop);
    }

    /** Trie la liste par le champs spécifié. */
    public sort$(name?: string) {
        const sortField = name || this._textField;

        if (!this._sortInfos) {
            this._sortInfos = {
                name: sortField,
                order: SortOrder.ascending,
            };
        } else if (sortField === this._sortInfos.name) {
            this._sortInfos.order = this._sortInfos.order === SortOrder.ascending ? SortOrder.descending : SortOrder.ascending;
        } else {
            this._sortInfos.name = sortField;
            this._sortInfos.order = SortOrder.ascending;
        }
        return this.getItemListService().sort$(this._sortInfos)
            .first()
            .switchMap((si) => this.calcViewList$().first().map(() => si));
    }

    /** Groupe les éléments en fonction du modèle de groupe spécifié
     * @param groupInfos Modèle de groupe à appliquer.
     * @return Observable résolu par la fonction.
     */
    public group$(groups: IGroupInfo[]) {
        return this.getItemListService().group$(groups)
            .switchMap(() => this.calcViewList$().first());
    }

    /** Retire les groupe correspondants au modèle de groupe spécifié
     * @param groupInfos Modèle de groupe à retirer.
     * @return Observable résolu par la fonction.
     */
    public ungroup$(groupInfo: IGroupInfo) {
        return this.getItemListService().ungroup$(groupInfo)
            .switchMap(() => this.calcViewList$().first());
    }

    /** Change l'état d'expansion de tous les éléments.
     * @return Observable résolu par la fonction.
     */
    public toggleAll$(collapsed?: boolean): Observable<IItemTree[]> {
        this.allCollapsed = (collapsed !== undefined) ? collapsed : !this.allCollapsed;
        if (this.viewPort.mode === ViewportMode.disabled) {
            return Observable.from(this._itemList)
                .filter((item: IItemTree) => item.$items && item.depth === 0 && item.collapsible !== false)
                .switchMap((_item: IItemTree, index: number) => this.toggleCollapse$(index + this.vpStartRow, this.allCollapsed))
                .reduce((acc, item) => {
                    acc.push(item);
                    return acc;
                }, [] as IItemTree[]);
        } else {
            return this.getItemListService().toggleAll$(this.allCollapsed);
        }
    }

    /** Change l'état d'expansion de l'élément spécifié par son index sur la liste des éléments visibles.
     * @param index  Index sur la liste des éléments visibles de l'élément à changer.
     * @param collapse  Etat de l'élément. True pour réduire l'élément.
     * @return Observable résolu par la fonction.
     */
    public toggleCollapse$(index: number, collapsed: boolean): Observable<IItemTree> {
        return this.getItemListService().toggleCollapse$(index, collapsed)
            .switchMap((toogleResult) => this.calcViewList$().first().map(() => toogleResult));
    }

    /** Déselectionne tous les éléments sélectionés.
     * @return Observable résolu par la fonction.
     */
    public unselectAll$() {
        const itemListService = this.getItemListService();
        return itemListService.unselectAll$();
    }

    /** Nettoye les caches et réaffiche le viewport. */
    public refresh() {
        this.getItemListService().invalidateCache();
        this.calcViewList$()
            .first()
            .subscribe(noop);
    }

    /** Recalcule le viewport. */
    public refreshViewPort(item?: IItemBase | IItemBase[], clearMeasuredHeight?: boolean) {
        const refreshParams = {} as IViewPortRefreshParams;
        if (item) {
            refreshParams.items = item instanceof Array ? item : [item];
        }
        if (clearMeasuredHeight) {
            refreshParams.clearMeasuredSize = clearMeasuredHeight;
        }
        this.viewPort.refresh(refreshParams);
        this.changeDetectorRef.markForCheck();
    }

    /** Efface le viewport */
    public clearViewPort() {
        this.viewPort.clear();
    }

    /** Efface la hauteur calculée des lignes en mode automatique */
    public clearRowsHeight() {
        this.getItemListService().invalidateRowsHeightCache();
    }

    /** Retrouve les informations du parent de l'élément spécifié
     * @param item Element enfant du parent à retrouver.
     * @return Observable résolu par la fonction, qui retourne les informations sur le parent de l'élément spécifié
     */
    public getParentListInfos$(item: IItemTree): Observable<IParentListInfoResult> {
        return this.getItemListService().getParentListInfos$(item, this._multiSelect);
    }

    public get listElementId() {
        return this._listElementId;
    }

    public get listElement() {
        // Can be an overlay
        return this._listElement || document.getElementById(this.listElementId);
    }

    public set listElement(elem: HTMLElement) {
        this._listElement = elem;
    }

    protected getSelectedModels() {
        return this.getItemListService().getSelectedItems().map((itm) => itm.model !== undefined ? itm.model : itm);
    }

    protected setSelectedModels(values: any[]) {
        return this.setSelectedItems(values && this.mapToIItemBase(values, true));
    }

    /** Trouve l'élément suivant répondant à la fonction de comparaison spécifiée.
     * @param compare Function de comparaison pour la recherche de l'élément.
     * @param startIndex Index de départ sur la liste des éléments visibles.
     * @return Observable résolu par la fonction.
     */
    protected findNextMatch$(compare?: (item: IItemBase, index: number) => boolean, startIndex?: number): Observable<IFindItemResult> {
        return this.ensureListCaches$()
            .switchMap(() => this.getItemListService().findNextMatch$(compare, startIndex));
    }

    /** Définit la hauteur d'une ligne pour le calcul du viewport. Le Viewport ne fonctionne qu'avec des hauteurs de lignes fixe.
     * Pour désactiver le viewport, mettre la hauteur de ligne à 0.
     * Attention, une désactivation du viewport dégrade considérablement les performances de la liste et ne doit pas être activée si la liste
     * est suceptible de contenir beaucoup d'éléments.
     * @param value Hauteur de ligne à utiliser pour le calcul du viewport.
     */
    protected setViewPortRowHeight(value: number | string) {
        this._viewPortRowHeight = coerceNumberProperty(value);
        if (value) {
            this.viewPort.itemsSize$.next(this._viewPortRowHeight);
        }
    }

    public getViewPortRowHeight() {
        return this._viewPortRowHeight || ViewPortService.itemDefaultSize;
    }

    /** Definit le service de liste utilisé par ce composant.
     * @param value Service de liste utilisé par ce composant.
     */
    protected setItemListService(value: ItemListService) {
        if (this.waiter$sub) {
            this.waiter$sub.unsubscribe();
            this.waiter$sub = undefined;
        }
        this._itemListService = value;
        if (this._itemListService) {
            this._itemListService.hideSelected = this._hideSelected;
            this._itemListService.childrenField = this._childrenField;
            this._itemListService.valueField = this._valueField;
            this.waiter$sub = Observable.from(this._itemListService.waiter$)
                .takeWhile(() => this._isAlive)
                .subscribe((status: boolean) => {
                    this._waiter = status;
                    this.changeDetectorRef.markForCheck();
                });
        }
    }

    /** Definit le service de tri utilisé par ce composant.
     * @param value Service de tri utilisé par ce composant.
     */
    protected setSortingService(value: SortingService) {
        if (!value && !this._itemListService) {
            return;
        }
        this._itemListService.setSortingService(value);
    }

    /** Definit le service de regroupement utilisé par ce composant.
     * @param value Service de regroupement utilisé par ce composant.
     */
    protected setGroupingService(value: GroupingService) {
        if (!value && !this._itemListService) {
            return;
        }
        this._itemListService.setGroupingService(value);
    }

    /** Définit le texte à afficher dans la zone de conseil.
     * @param value Texte à afficher.
     */
    protected setHintLabel(value: string) {
        this._hintLabel = value;
    }

    /** Définit le texte à afficher si la liste est vide.
     * @param value Texte à afficher.
     */
    protected setNodataLabel(value: string) {
        this._nodataLabel = value;
    }

    protected setCurrentItemIndex(value: number) {
        this._currentItemIndex = value;
        this._currentItem = null;
    }

    protected getCurrentItemIndex() {
        return this._currentItemIndex;
    }

    /** Retourne l'élément courant (actif).
     * @return Elément courant.
     */
    public getCurrentItem() {
        if (!this._currentItem && this._currentItemIndex >= 0) {
            this._currentItem = this.getItemListService().getItemFromIndex(this._currentItemIndex);
        }
        return this._currentItem;
    }

    /** Définit l'élément courant (actif).
     * @param item Elément courant.
     */
    protected setCurrentItem(item: IItemBase) {
        this._currentItemIndex = item ? this.getItemListService().getItemIndex(item) : -1;
        this._currentItem = item;
    }

    /** Retourne l'index correspondant à l'élément spéficié dans la liste des éléments visibles
     * @param item Element à chercher sur la liste des éléments visibles.
     * @return Index correspondant à l'élément recherché.
     */
    protected getItemIndex(item: IItemBase) {
        return item && this.getItemListService() ? this.getItemListService().getItemIndex(item) : -1;
    }

    /** Définit si plusieurs éléments peuvent être sélectionés.
     * @param value True si plusieurs éléments peuvent être sélectionés.
     */
    protected setMultiSelect(value: boolean) {
        this._multiSelect = value;
    }

    /** Définit le modèle utilisé par la liste. Il est uniquement de type IItemBase. Ce model peut ètre hierarchique sans limitation de la profondeur ou une chargé en asynchrone par une promise ou un observable.
     * @param items Provider de la liste des éléments de la liste.
     */
    protected setItems$(items: IItemBase[] | Promise<IItemBase[]> | Observable<IItemBase[]>) {
        if (!(items instanceof Array)) {
            this.clearViewPort();
        }
        return this.getItemListService().setItems$(items);
    }

    /** Définit le modèle utilisé par la liste. Il peut être de tout type d'objet. Ce model peut ètre hierarchique sans limitation de la profondeur ou une chargé en asynchrone par une promise ou un observable.
     * @param items Provider de la liste des éléments de la liste.
     */
    protected setModels$(models: any[] | Observable<any[]>) {
        let models$: Observable<any[]>;

        if (models instanceof Array) {
            models$ = Observable.of(models);
        } else {
            models$ = models as Observable<any[]>;
        }

        const items$ = models$ && models$.map((model) => this.mapToIItemBase(model));
        return this.setItems$(items$);
    }

    // Ne pas utiliser, cette fonction retourne la liste des éléments pour l'implémentation de ngModel.
    protected getItems() {
        return this.getItemListService().getItems();
    }

    /** Usage interne. Termine le drag and drop en cours. */
    protected drop$() {
        this.setCurrentItemIndex(-1);
        return this.getItemListService().drop$();
    }

    /** Usage interne. Retourne la portion de la liste à afficher en fonction des paramètres spécifiés. */
    protected getViewList$(query?: RegExp | string, ignoreCache?: boolean): Observable<IViewListResult> {
        if (typeof query === 'string' && (query || '').length < this._minSearchLength) {
            const emptyListResult = {
                depthMax: 0,
                visibleList: [],
            } as IViewListResult;

            if (!this.getItems()) {
                return this.setItems$([]).map(() => emptyListResult);
            } else {
                return Observable.of(emptyListResult);
            }
        }

        return this.getItemListService()
            .getViewList$(this._searchField || this._textField, query, ignoreCache, this._ddStartIndex, this._ddTargetIndex, this._multiSelect);
    }

    /** Sélectionne une plage d'éléments en fonction de l'index de début et l'index de fin sur la liste des éléments visibles.
     * @param indexFrom index sur la liste des éléments visibles du premier élément à sélectioner.
     * @param indexTo index sur la liste des éléments visibles du dernier élément à sélectioner.
     * @return Observable résolu par la fonction.
     */
    protected selectRange$(indexFrom: number, indexTo?: number) {
        const itemListService = this.getItemListService();
        return this.ensureListCaches$()
            .switchMap(() => itemListService.selectRange$(indexFrom, indexTo));
    }

    /** Change l'état de selection de l'élément spécifié.
     * @param items Liste des éléments à modifier.
     * @param selected True si les éléments divent être sélectionés, False si ils doivent être déselectionés.
     * @return Observable résolu par la fonction.
     */
    protected toggleSelect$(items: IItemBase[], selected: boolean) {
        const itemListService = this.getItemListService();
        return itemListService.toggleSelect$(items, selected);
    }

    /** Définit si l'élément spécifié peut être réduit.
     * @param item Elément à analyser.
     * @return True si l'élément peut être réduit.
     */
    protected isCollapsible(item: IItemTree) {
        return item && item.$items && item.collapsible !== false;
    }

    /** Définit si l'élément spécifié est selectionable.
     * @param item Elément à analyser.
     * @return True si l'élément est selectionable.
     */
    protected isSelectable(item: IItemBase) {
        return item && item.selectable !== false;
    }

    /** Définit le champ à utiliser comme valeur d'affichage.
     * @param value Champ à utiliser comme valeur d'affichage.
     */
    protected setTextField(value: string) {
        this._textField = value;
    }

    /** Retourne le champ utilisé comme valeur d'affichage.*/
    protected getTextField() {
        return this._textField || ItemListService.defaultTextField;
    }

    /** Définit le champ à utiliser comme valeur de comparaison.
     * @param value Champ à utiliser comme valeur de comparaison.
     */
    protected setValueField(value: string) {
        this._valueField = value;
        if (this._itemListService) {
            this._itemListService.valueField = value;
        }
    }

    /** Retourne le champ utilisé comme valeur de comparaison.*/
    protected getValueField() {
        return this._valueField || ItemListService.defaultValueField;
    }

    /** Définit le champ à utiliser comme champ de recherche.
     * Ce champ peut indiquer, un champ contenant une valeur, un texte indexé, ou une fonction.
     * @param value Champ à utiliser comme champ de recherche.
     */
    protected setSearchField(value: string) {
        this._searchField = value;
    }

    /** Définit la hauteur maximum avant que le composant affiche une scrollbar
     * spécifier une grande valeur pour ne jamais afficher de scrollbar
     * Spécifier 0 pour que le composant determine sa hauteur à partir du container
     */
    protected setMaxHeight(value: number | string) {
        this._maxHeight = value === 'auto' ? null : +value || null;
        this.viewPort.maxSize$.next(value);
    }

    /** Retourne la hauteur maximum avant que le composant affiche une scrollbar
     * spécifier une grande valeur pour ne jamais afficher de scrollbar
     * Spécifier 0 pour que le composant determine sa hauteur à partir du container
     */
    protected getMaxHeight() {
        return this._maxHeight;
    }

    /** Internal usage. Calc the best target when an item is drag and dropped */
    protected calcDragTargetIndex$(index: number, targetIndex: number) {
        return this.ensureListCaches$()
            .switchMap(() => this.getItemListService().calcDragTargetIndex$(index, targetIndex));
    }

    /** Internal usage */
    protected getItemTreeInfo(items: IItemBase[], item: IItemBase): IItemTreeInfo {
        const parentIndex = items.findIndex((itm) => itm === item);
        if (parentIndex < 0) {
            return null;
        }

        const treeItem = item as IItemTree;
        const parentDepth = treeItem.depth;
        let lastIndex = parentIndex;
        const children = [] as IItemBase[];

        if (parentDepth !== undefined) {
            for (let i = parentIndex + 1; i < items.length; i++) {
                const curItem = items[i] as IItemTree;
                if (curItem.depth <= parentDepth) {
                    break;
                }
                children.push(curItem);
                lastIndex = i;
            }
        }

        return {
            children: children,
            item: item,
            lastIndex: lastIndex,
            startIndex: parentIndex,
        } as IItemTreeInfo;
    }

    /** Calcule le viewport pour le conteneur spécifié. */
    protected calcViewList$(query?: string): Observable<IViewListResult> {
        return this.getViewList$(query)
            .do((result: IViewListResult) => {
                if (result.depthMax !== undefined) {
                    this._depthMax = result.depthMax;
                }
                this.rowsCount = result.visibleList.length;
                this.viewPort.items$.next(result.visibleList);
            });
    }

    protected ensureListCaches$(): Observable<IViewListResult> {
        return this._itemListService.hasCache ? Observable.of(null) : this.getViewList$();
    }

    /** Calcul la position de la scrollbar pour que l'élément spécifié soit dans la zone visible. */
    protected ensureItemVisible(item: IItemBase | number) {
        this.viewPort.ensureItem$.next(item);
    }

    protected mapToIItemBase(modls: any[], selected?: boolean): IItemBase[] {
        const m = modls || [];
        return m.map((model) => {
            const itemBase: IItemBase = {};

            itemBase.model = model;

            const displayField = this.getTextField();
            const valueField = this.getValueField();

            if (typeof model === 'string') {
                itemBase[displayField] = model;
                itemBase[valueField] = model;

                if (this._searchField) {
                    itemBase[this._searchField] = model;
                }

            } else {
                itemBase[displayField] = this.getTextValue(model);
                itemBase[valueField] = model[this._valueField];

                if (this._searchField) {
                    itemBase[this._searchField] = model[this._searchField];
                }
            }

            const childrenField = this.getItemListService().childrenField;
            if (model[childrenField]) {
                itemBase[childrenField] = this.mapToIItemBase(model[childrenField], selected);
            } else {
                itemBase.selected = selected || undefined;
            }

            return itemBase;
        });
    }

    protected getItemHeight(item: IItemBase) {
        if (this.viewPort.mode === ViewportMode.disabled) {
            return null;
        } else if (this.viewPort.mode === ViewportMode.fixed) {
            return this.getViewPortRowHeight();
        } else if (this.viewPort.mode === ViewportMode.auto) {
            return item.size || null;
        } else {
            return (item.size && item.size > ViewPortService.itemDefaultSize) ? item.size : this.getViewPortRowHeight();
        }
    }

    protected getVirtualSelectedEntities(value) {
        const map = (v) => {
            const model = {};
            const textField = this.getTextField();
            const valueField = this.getValueField();
            model[textField] = `${v}`.trim();
            model[valueField] = v;
            return model;
        };

        if (value) {
            const modelType = typeof value;
            if (modelType === 'string' || modelType === 'number') {
                value = this._multiSelect ? value.split(',').map(map) : map(value);
            } else if (value instanceof Array && value.length) {
                const type = typeof value[0];
                if (type === 'string' || type === 'number') {
                    value = this._multiSelect ? value.map(map) : map(value[0]);
                }
            } else if (value instanceof Array && !this._multiSelect) {
                value = null;
            }
        }

        return value;
    }
}

export interface IItemTreeInfo {
    item?: IItemBase;
    children?: IItemBase[];
    startIndex: number;
    lastIndex?: number;
}
