/*
 * *
 *  @license
 *  Copyright Hôpitaux Universitaires de Genève All Rights Reserved.
 *
 *  Use of this source code is governed by an Apache-2.0 license that can be
 *  found in the LICENSE file at https://github.com/DSI-HUG/dejajs-components/blob/master/LICENSE
 * /
 *
 */

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ContentChild, ElementRef, EventEmitter, forwardRef, Input, OnDestroy, Output, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { coerceBooleanProperty } from '@angular/material/core/coercion/boolean-property';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs/Rx';
import { Position } from '../../common/core/graphics/position';
import { Rect } from '../../common/core/graphics/rect';
import { GroupingService } from '../../common/core/grouping';
import { IItemBase, IItemTree, ItemListBase, ItemListService, IViewPort, ViewportMode, ViewPortService } from '../../common/core/item-list';
import { KeyCodes } from '../../common/core/keycodes.enum';
import { SortingService } from '../../common/core/sorting';
import { IDejaDragEvent } from '../dragdrop';
import { DejaTreeListItemEvent, DejaTreeListItemsEvent, DejaTreeListScrollEvent } from './index';

const noop = () => { };

const TreeListComponentValueAccessor = {
    multi: true,
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DejaTreeListComponent),
};

/** Composant de liste évoluée avec gestion de viewport et templating */
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    providers: [TreeListComponentValueAccessor, ViewPortService],
    selector: 'deja-tree-list',
    styleUrls: [
        './tree-list.component.scss',
    ],
    templateUrl: './tree-list.component.html',
})
export class DejaTreeListComponent extends ItemListBase implements OnDestroy, AfterViewInit {
    /** Texte à afficher par default dans la zone de recherche */
    @Input() public placeholder: string;
    /** Texte affiché si aucune donnée n'est présente dans le tableau */
    @Input() public nodataholder: string;
    /** Correspond au ngModel du champ de filtrage ou recherche */
    @Input() public query = '';
    /** Hauteur maximum avant que le composant affiche une scrollbar
     * spécifier une grande valeur pour ne jamais afficher de scrollbar
     * Spécifier 0 pour que le composant determine sa hauteur à partir du container
     */
    @Input() public maxHeight = 0;
    /** Permet de définir un template de ligne par binding */
    @Input() public itemTemplateExternal;
    /** Permet de définir un template de ligne parente par binding. */
    @Input() public parentItemTemplateExternal;
    /** Permet de définir un template pour le loader par binding. */
    @Input() public loaderTemplateExternal;
    /** Permet de définir un template d'entête de colonne par binding. */
    @Input() public headerTemplateExternal;
    /** Permet de définir un template comme prefixe de la zone de recherche par binding. */
    @Input() public searchPrefixTemplateExternal;
    /** Permet de définir un template comme suffixe de la zone de recherche par binding. */
    @Input() public searchSuffixTemplateExternal;

    /** Exécuté lorsque le déplacement d'une ligne est terminée. */
    @Output() public itemDragEnd = new EventEmitter<IDejaDragEvent>();
    /** Exécuté lorsque le déplacement d'une ligne commence. */
    @Output() public itemDragStart = new EventEmitter<IDejaDragEvent>();
    /** Exécuté lorsque la scrollbar change de position. */
    @Output() public scroll = new EventEmitter<DejaTreeListScrollEvent>();
    /** Exécuté lorsque l'utilisateur sélectionne ou désélectionne une ligne. */
    @Output() public selectedChange = new EventEmitter<DejaTreeListItemsEvent | DejaTreeListItemEvent>();
    /** Exécuté lorsque le calcul di viewPort est executé à l'initialisation. */
    @Output() public afterViewInit = new EventEmitter();

    /** Internal use */
    @ViewChild('listcontainer') public listcontainer: ElementRef;
    @ViewChild('inputelement') public input: ElementRef;

    // NgModel implementation
    protected onTouchedCallback: () => void = noop;
    protected onChangeCallback: (_: any) => void = noop;

    protected keyboardNavigation = false;

    @ViewChildren('listitem') private listItemElements: QueryList<ElementRef>;

    // Templates
    @ContentChild('itemTemplate') private itemTemplateInternal;
    @ContentChild('parentItemTemplate') private parentItemTemplateInternal;
    @ContentChild('loaderTemplate') private loaderTemplateInternal;
    @ContentChild('headerTemplate') private headerTemplateInternal;
    @ContentChild('searchPrefixTemplate') private searchPrefixTemplateInternal;
    @ContentChild('searchSuffixTemplate') private searchSuffixTemplateInternal;

    // protected _items: IItemBase[]; In the base class, correspond to the model
    private clickedItem: IItemBase;
    private rangeStartIndex = 0;
    private ignoreNextScrollEvents = false;
    private filterExpression = '';
    private lastScrollTop = 0;
    private _searchArea = false;
    private _expandButton = false;
    private _sortable = false;
    private _itemsDraggable = false;
    private hasCustomService = false;

    private keyboardNavigation$ = new Subject();

    private subscriptions: Subscription[] = [];
    private mouseUp$sub: Subscription;

    private clearFilterExpression$ = new BehaviorSubject<void>(null);
    private filterListComplete$ = new Subject();

    constructor(changeDetectorRef: ChangeDetectorRef, viewPort: ViewPortService, public elementRef: ElementRef) {
        super(changeDetectorRef, viewPort);

        this.subscriptions.push(Observable.from(this.clearFilterExpression$)
            .debounceTime(750)
            .subscribe(() => this.filterExpression = ''));

        this.subscriptions.push(Observable.from(this.filterListComplete$)
            .debounceTime(250)
            .do(() => this.setCurrentItem(undefined))
            .switchMap(() => this.calcViewPort$())
            .subscribe(noop));

        this.subscriptions.push(Observable.from(this.keyboardNavigation$)
            .do(() => this.keyboardNavigation = true)
            .debounceTime(1000)
            .subscribe(() => {
                this.keyboardNavigation = false;
                this.changeDetectorRef.markForCheck();
            }));
    }

    /** Définit la longueur minimale de caractères dans le champ de recherche avant que la recherche ou le filtrage soient effectués */
    @Input('min-search-length')
    public set minSearchlength(value: number) {
        this._minSearchLength = value;
    }

    public get minSearchlength() {
        return this._minSearchLength;
    }

    /** Affiche un barre de recherche au dessus de la liste. */
    @Input()
    public set searchArea(value: boolean) {
        this._searchArea = coerceBooleanProperty(value);
    }

    public get searchArea() {
        return this._searchArea;
    }

    /** Affiche un bouton pour réduire ou étendre toutes les lignes parentes du tableau */
    @Input()
    public set expandButton(value: boolean) {
        this._expandButton = coerceBooleanProperty(value);
    }

    public get expandButton() {
        return this._expandButton;
    }

    /** Permet de trier la liste au clic sur l'entête */
    @Input()
    public set sortable(value: boolean) {
        this._sortable = coerceBooleanProperty(value);
    }

    public get sortable() {
        return this._sortable;
    }

    /** Rend les lignes de la liste draggable vers un autre composant (ne pas confondre avec la propriété `sortable`) */
    @Input()
    public set itemsDraggable(value: boolean) {
        this._itemsDraggable = coerceBooleanProperty(value);
    }

    public get itemsDraggable() {
        return this._itemsDraggable;
    }

    @Input()
    /** Définit le nombre de lignes à sauter en cas de pression sur les touches PageUp ou PageDown */
    public set pageSize(value: number) {
        this._pageSize = value;
    }

    /** Retourne le nombre de lignes à sauter en cas de pression sur les touches PageUp ou PageDown */
    public get pageSize() {
        if (this._pageSize === 0) {
            const vpRowHeight = this.getViewPortRowHeight();
            const containerElement = this.listcontainer.nativeElement as HTMLElement;
            const containerHeight = this.maxHeight || containerElement.clientHeight;
            return Math.floor(containerHeight / vpRowHeight);
        }

        return this._pageSize;
    }

    /** Définit un texte de conseil en cas d'erreur de validation ou autre */
    @Input()
    public set hintLabel(value: string) {
        this.setHintLabel(value);
    }

    /** Retourne un texte de conseil en cas d'erreur de validation ou autre */
    public get hintLabel(): string {
        return this._hintLabel;
    }

    /** Définit la hauteur d'une ligne pour le calcul du viewport en pixels (la valeur par défaut sera utilisée si aucune valeur n'est setté). */
    @Input()
    public set viewPortRowHeight(value: number) {
        this.setViewPortRowHeight(value);
    }

    /**
     * Les trois valeurs acceptés en paramètre se trouvent dans l'enum ViewportMode (NoViewport, ConstantRowheight, VariableRowHeight ou AutoRowHeight)
     * Attention, une désactivation du viewport dégrade considérablement les performances de la liste et ne doit pas être activée si la liste
     * est suceptible de contenir beaucoup d'éléments.
     */
    @Input()
    public set viewportMode(mode: ViewportMode) {
        this.setViewportMode(mode);
    }

    /** Retourne le champ utilisé pour la liste des enfants d'un parent */
    @Input()
    public set childrenField(value: string) {
        super.setChildrenField(value);
    }

    /** Définit le champ utilisé pour la liste des enfants d'un parent */
    public get childrenField() {
        return this._childrenField;
    }

    /** Définit le champ à utiliser comme valeur d'affichage. */
    @Input()
    public set textField(value: string) {
        super.setTextField(value);
    }

    /** Définit le champ à utiliser comme valeur de comparaison. */
    @Input()
    public set valueField(value: string) {
        super.setValueField(value);
    }

    /** Définit le champ à utiliser comme champ de recherche.
     * Ce champ peut indiquer, un champ contenant une valeur, un texte indexé, ou une fonction.
     */
    @Input()
    public set searchField(value: string) {
        super.setSearchField(value);
    }

    /** Retourne le champ à utiliser comme champ de recherche.
     * Ce champ peut indiquer, un champ contenant une valeur, un texte indexé, ou une fonction.
     */
    public get searchField() {
        return this._searchField;
    }

    /** Définit la ligne courant ou ligne active */
    @Input()
    public set currentItem(item: IItemBase) {
        super.setCurrentItem(item);
        if (item) {
            this.ensureItemVisible(item);
        }
    }

    /** Retourne la ligne courant ou ligne active */
    public get currentItem() {
        return super.getCurrentItem();
    }

    /** Retourne le nombre de niveau pour une liste hierarchique */
    public get depthMax() {
        return this._depthMax;
    }

    /** Définit une valeur indiquant si plusieurs lignes peuvent être sélectionées. */
    @Input()
    public set multiSelect(value: boolean) {
        super.setMultiSelect(coerceBooleanProperty(value) !== false);
    }

    /** Retourne une valeur indiquant si plusieurs lignes peuvent être sélectionées. */
    public get multiSelect() {
        return this._multiSelect;
    }

    /** Définit la liste des éléments selectionés en mode multiselect */
    @Input()
    public set selectedItems(items: IItemBase[]) {
        this.setSelectedModels(items);
    }

    /** Retourne la liste des éléments selectionés en mode multiselect */
    public get selectedItems(): IItemBase[] {
        return this.getSelectedModels() || [];
    }

    /** Définit la liste des éléments selectionés en mode single select */
    @Input()
    public set selectedItem(item: IItemBase) {
        if (this.multiSelect) {
            throw new Error('selectedItem binding is for single selection only, use selectedItems for multi selection');
        }

        this.selectedItems = item && [item];
    }

    /** Retourne la liste des éléments selectionés en mode single select */
    public get selectedItem() {
        if (this.multiSelect) {
            throw new Error('selectedItem is for single selection only, use selectedItems for multi selection');
        }

        return this.selectedItems[0];
    }

    /** Definit le service de liste utilisé par ce composant. Ce srevice permet de controller dynamiquement la liste, ou de faire du lazyloading. */
    @Input()
    public set itemListService(value: ItemListService) {
        this.hasCustomService = true;
        this.setItemListService(value);
    }

    /** Retourne le service de liste utilisé par ce composant. Ce srevice permet de controller dynamiquement la liste, ou de faire du lazyloading. */
    public get itemListService() {
        return this.getItemListService();
    }

    /** Definit le service utilisé pour le tri de la liste */
    @Input()
    public set sortingService(value: SortingService) {
        this.setSortingService(value);
    }

    /** Definit le service utilisé pour le regroupement de la liste */
    @Input()
    public set groupingService(value: GroupingService) {
        this.setGroupingService(value);
    }

    /** Définit la liste des éléments */
    @Input()
    public set items(items: IItemBase[] | Promise<IItemBase[]> | Observable<IItemBase[]>) {
        this.writeValue(items);
    }

    /**
     * Set a promise called before an item selection
     */
    @Input()
    public set selectingItem(fn: (item: any) => Promise<any>) {
        super.setSelectingItem(fn);
    }

    /**
     * Set a promise called before an item deselection
     */
    @Input()
    public set unselectingItem(fn: (item: any) => Promise<any>) {
        super.setUnselectingItem(fn);
    }

    /** Définit la liste des éléments (tout type d'objet métier) */
    @Input()
    public set models(items: any[] | Observable<any[]>) {
        super.setModels$(items)
            .first()
            .switchMap(() => this.calcViewPort$())
            .subscribe(() => {
            }, (error: any) => {
                this._hintLabel = error.toString();
            });
    }

    private set currentItemIndex(value: number) {
        super.setCurrentItemIndex(value);
        this.changeDetectorRef.markForCheck();
    }

    private get currentItemIndex() {
        return this.getCurrentItemIndex();
    }

    private get itemTemplate() {
        return this.itemTemplateExternal || this.itemTemplateInternal;
    }

    private get parentItemTemplate() {
        return this.parentItemTemplateExternal || this.parentItemTemplateInternal;
    }

    private get loaderTemplate() {
        return this.loaderTemplateExternal || this.loaderTemplateInternal;
    }

    private get headerTemplate() {
        return this.headerTemplateExternal || this.headerTemplateInternal;
    }

    private get searchPrefixTemplate() {
        return this.searchPrefixTemplateExternal || this.searchPrefixTemplateInternal;
    }

    private get searchSuffixTemplate() {
        return this.searchSuffixTemplateExternal || this.searchSuffixTemplateInternal;
    }

    // ************* ControlValueAccessor Implementation **************
    /** Définit la liste des éléments, sans invoquaer ngModelChange */
    public writeValue(items: any) {
        delete this.hintLabel;
        super.setItems$(items)
            .switchMap((itms) => {
                if (this.minSearchlength > 0 && !this.query) {
                    // Waiting for query
                    this._itemList = [];
                    this.changeDetectorRef.markForCheck();
                    return Observable.of(itms);
                } else {
                    return this.calcViewPort$().map(() => itms);
                }
            })
            .subscribe(() => {
            }, (error: any) => {
                this.hintLabel = error.toString();
                this._itemList = [];
            });
    }

    // From ControlValueAccessor interface
    public registerOnChange(fn: any) {
        this.onChangeCallback = fn;
    }

    // From ControlValueAccessor interface
    public registerOnTouched(fn: any) {
        this.onTouchedCallback = fn;
    }
    // ************* End of ControlValueAccessor Implementation **************

    /** Change l'état d'expansion de toute les lignes parentes */
    public toggleAll$(): Observable<IItemTree> {
        return super.toggleAll$()
            .switchMap(() => this.calcViewPort$());
    }

    /** Change l'état d'expansion de toute les lignes parentes */
    public toggleAll() {
        this.toggleAll$().first().subscribe(noop);
    }

    /** Positionne a scrollbar pour assurer que l'élément spécifié soit visible */
    public ensureItemVisible(item: IItemBase | number) {
        super.ensureItemVisible(this.query, this.listcontainer.nativeElement, this.listItemElements, item);
    }

    /** Efface le contenu de la liste */
    public clearViewPort() {
        super.clearViewPort();
        this.changeDetectorRef.markForCheck();
    }

    public ngAfterViewInit() {
        // FIXME Issue angular/issues/6005
        // see http://stackoverflow.com/questions/34364880/expression-has-changed-after-it-was-checked
        if (this._itemList.length === 0 && this.hasCustomService) {
            Observable.timer(1)
                .first()
                .switchMap(() => this.calcViewPort$())
                .subscribe(noop);
        }

        this.subscriptions.push(Observable
            .fromEvent(window, 'resize')
            .switchMap((e: Event) => {
                if (this.viewPort.mode !== ViewportMode.NoViewport && this.maxHeight === 0) {
                    this.computedMaxHeight = 0;
                    return this.calcViewPort$().map(() => e);
                } else {
                    return Observable.of(e);
                }
            })
            .subscribe(noop));

        this.subscriptions.push(Observable
            .fromEvent(this.listcontainer.nativeElement, 'scroll')
            .map((event: any) => [event, event.target.scrollTop, event.target.scrollLeft])
            .map(([event, scrollTop, scrollLeft]: [Event, number, number]) => {
                const e = {
                    originalEvent: event,
                    scrollLeft: scrollLeft,
                    scrollTop: scrollTop,
                } as DejaTreeListScrollEvent;

                this.scroll.emit(e);
                return scrollTop;
            })
            .filter((scrollTop: number) => this.lastScrollTop !== scrollTop)
            .switchMap((scrollTop: number) => {
                if (this.viewPort.mode === ViewportMode.NoViewport && this.ignoreNextScrollEvents) {
                    this.ignoreNextScrollEvents = false;
                    return Observable.of(scrollTop);
                } else {
                    this.lastScrollTop = scrollTop;
                    return this.calcViewPort$().map(() => scrollTop);
                }
            })
            .debounceTime(30)
            .switchMap(() => this.calcViewPort$())
            .subscribe(noop));

        let keyDown$ = Observable.fromEvent(this.listcontainer.nativeElement, 'keydown');
        if (this.input) {
            const inputKeyDown$ = Observable.fromEvent(this.input.nativeElement, 'keydown');
            keyDown$ = keyDown$.merge(inputKeyDown$);
        }

        this.subscriptions.push(keyDown$
            .filter((event: KeyboardEvent) => event.keyCode === KeyCodes.Home ||
                event.keyCode === KeyCodes.End ||
                event.keyCode === KeyCodes.PageUp ||
                event.keyCode === KeyCodes.PageDown ||
                event.keyCode === KeyCodes.UpArrow ||
                event.keyCode === KeyCodes.DownArrow ||
                event.keyCode === KeyCodes.Space ||
                event.keyCode === KeyCodes.Enter)
            .switchMap((event) => this.ensureListCaches$().map(() => event))
            .map((event: KeyboardEvent) => {
                // Set current item from index for keyboard features only
                const setCurrentIndex = (index: number) => {
                    this.currentItemIndex = index;
                    this.ensureItemVisible(this.currentItemIndex);
                };

                const currentIndex = this.rangeStartIndex >= 0 ? this.rangeStartIndex : this.rangeStartIndex = this.currentItemIndex;

                switch (event.keyCode) {
                    case KeyCodes.Home:
                        if (event.shiftKey) {
                            this.selectRange$(currentIndex, 0).first().subscribe(noop);
                        } else if (!event.ctrlKey) {
                            this.rangeStartIndex = 0;
                            this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                        }
                        setCurrentIndex(0);
                        return false;

                    case KeyCodes.End:
                        if (event.shiftKey) {
                            this.selectRange$(currentIndex, this.rowsCount - 1).first().subscribe(noop);
                        } else if (!event.ctrlKey) {
                            this.rangeStartIndex = this.rowsCount - 1;
                            this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                        }
                        setCurrentIndex(this.rowsCount - 1);
                        return false;

                    case KeyCodes.PageUp:
                        const upindex = Math.max(0, this.currentItemIndex - this.pageSize);
                        if (event.shiftKey) {
                            this.selectRange$(currentIndex, upindex).first().subscribe(noop);
                        } else if (!event.ctrlKey) {
                            this.rangeStartIndex = upindex;
                            this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                        }
                        setCurrentIndex(upindex);
                        return false;

                    case KeyCodes.PageDown:
                        const dindex = Math.min(this.rowsCount - 1, this.currentItemIndex + this.pageSize);
                        if (event.shiftKey) {
                            this.selectRange$(currentIndex, dindex).first().subscribe(noop);
                        } else if (!event.ctrlKey) {
                            this.rangeStartIndex = dindex;
                            this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                        }
                        setCurrentIndex(dindex);
                        return false;

                    case KeyCodes.UpArrow:
                        const uaindex = Math.max(0, this.currentItemIndex - 1);
                        if (uaindex !== -1) {
                            if (event.shiftKey) {
                                this.selectRange$(currentIndex, uaindex).first().subscribe(noop);
                            } else if (!event.ctrlKey) {
                                this.rangeStartIndex = uaindex;
                                this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                            }
                            setCurrentIndex(uaindex);
                        }
                        return false;

                    case KeyCodes.DownArrow:
                        const daindex = Math.min(this.rowsCount - 1, this.currentItemIndex + 1);
                        if (daindex !== -1) {
                            if (event.shiftKey) {
                                this.selectRange$(currentIndex, daindex).first().subscribe(noop);
                            } else if (!event.ctrlKey) {
                                this.rangeStartIndex = daindex;
                                this.selectRange$(this.rangeStartIndex).first().subscribe(noop);
                            }
                            setCurrentIndex(daindex);
                        }
                        return false;

                    case KeyCodes.Space:
                        const target = event.target as HTMLElement;
                        if (target.tagName === 'INPUT' && !event.ctrlKey && !event.shiftKey) {
                            return true;
                        }

                        const sitem = this.currentItem as IItemTree;
                        if (sitem) {
                            if (this.isCollapsible(sitem)) {
                                this.toggleCollapse$(currentIndex, !sitem.collapsed).first().subscribe(noop);
                            } else if (sitem.selected) {
                                this.toggleSelect$([sitem], false).first().subscribe(noop);
                            } else if (this.multiSelect && event.ctrlKey) {
                                this.toggleSelect$([sitem], !sitem.selected).first().subscribe(noop);
                            } else {
                                this.unselectAll$()
                                    .switchMap(() => this.toggleSelect$([sitem], true))
                                    .first()
                                    .subscribe(noop);
                            }
                        }
                        return false;

                    case KeyCodes.Enter:
                        const eitem = this.currentItem as IItemTree;
                        if (eitem) {
                            if (this.isCollapsible(eitem) || eitem.selected) {
                                this.toggleCollapse$(currentIndex, !eitem.collapsed).first().subscribe(noop);
                            } else if (eitem.selectable) {
                                this.unselectAll$()
                                    .switchMap(() => this.toggleSelect$([eitem], true))
                                    .first()
                                    .subscribe(noop);
                            }
                        }
                        return false;

                    default:
                        return true;
                }
            })
            .subscribe((continuePropagation) => {
                if (!continuePropagation) {
                    this.keyboardNavigation$.next();
                    this.changeDetectorRef.markForCheck();
                    event.preventDefault();
                    return false;
                }
            }));


        let keyUp$ = Observable.fromEvent(this.listcontainer.nativeElement, 'keyup');
        if (this.input) {
            const inputKeyup$ = Observable.fromEvent(this.input.nativeElement, 'keyup');
            const inputDrop$ = Observable.fromEvent(this.input.nativeElement, 'drop');
            keyUp$ = keyUp$.merge(inputKeyup$, inputDrop$);
        }

        // Ensure list cache
        this.subscriptions.push(keyUp$
            .do(() => {
                if ((this.query || '').length < this.minSearchlength) {
                    this._itemList = [];
                    return;
                }
            })
            .filter((event: KeyboardEvent) => event.keyCode >= KeyCodes.Key0 ||
                event.keyCode === KeyCodes.Backspace ||
                event.keyCode === KeyCodes.Space ||
                event.keyCode === KeyCodes.Delete)
            .subscribe((event: KeyboardEvent) => {
                // Set current item from index for keyboard features only
                const setCurrentIndex = (index: number) => {
                    this.currentItemIndex = index;
                    this.ensureItemVisible(this.currentItemIndex);
                };

                if (!this.searchArea) {
                    if ((/[a-zA-Z0-9]/).test(event.key)) {
                        // Valid char
                        this.clearFilterExpression$.next(null);

                        // Search next
                        this.filterExpression += event.key;
                        const rg = new RegExp('^' + this.filterExpression, 'i');
                        this.findNextMatch$((item) => {
                            if (item && this.isSelectable(item)) {
                                const label = this.getTextValue(item);
                                if (rg.test(label)) {
                                    return true;
                                }
                            }
                            event.preventDefault();
                            return false;
                        }, this.currentItemIndex)
                            .first()
                            .subscribe((result) => {
                                if (result.index >= 0) {
                                    setCurrentIndex(result.index);
                                }
                            });
                    }
                } else {
                    // Autocomplete, filter the list
                    this.keyboardNavigation$.next();
                    if (event.keyCode !== KeyCodes.Space) {
                        this.filterListComplete$.next();
                    }
                }
            }));
    }

    public ngOnDestroy() {
        this.subscriptions.forEach((subscription: Subscription) => subscription.unsubscribe());
    }

    protected mousedown(e: MouseEvent) {
        if (this.mouseUp$sub) {
            this.mouseUp$sub.unsubscribe();
            this.mouseUp$sub = undefined;
        }

        const itemIndex = this.getItemIndexFromHTMLElement(e.target as HTMLElement);
        if (itemIndex === undefined) {
            return;
        }

        const item = this._itemList[itemIndex - this.vpStartRow];
        this.clickedItem = item;
        if (!this.isCollapsible(item) && this.isSelectable(item) && (!e.ctrlKey || !this.multiSelect) && (e.button === 0 || !item.selected)) {
            if (e.shiftKey && this.multiSelect) {
                // Select all from current to clicked
                this.selectRange$(itemIndex, this.currentItemIndex)
                    .first()
                    .subscribe(() => this.changeDetectorRef.markForCheck());
                return false;
            } else if (!e.ctrlKey || !this.multiSelect) {
                if (!this.multiSelect && item.selected) {
                    return;
                }

                this.unselectAll$().first().subscribe(() => {
                    this.currentItemIndex = itemIndex;
                    this.toggleSelect$([item], true)
                        .first()
                        .subscribe(() => this.changeDetectorRef.markForCheck());
                });
            }
        }

        const element = this.elementRef.nativeElement as HTMLElement;
        this.mouseUp$sub = Observable.fromEvent(element, 'mouseup')
            .first()
            .subscribe((upevt: MouseEvent) => {
                const upIndex = this.getItemIndexFromHTMLElement(upevt.target as HTMLElement);
                if (upIndex === undefined) {
                    return;
                }

                const upItem = this._itemList[upIndex - this.vpStartRow];
                if (this.clickedItem && upItem !== this.clickedItem) {
                    return;
                }

                if (upevt.shiftKey) {
                    return;
                }

                if (upevt.button !== 0) {
                    // Right click menu
                    return;
                }

                if (this.isCollapsible(upItem) || (upevt.target as HTMLElement).id === 'expandbtn') {
                    const treeItem = upItem as IItemTree;
                    this.toggleCollapse$(upIndex, !treeItem.collapsed).first().subscribe(() => {
                        this.currentItemIndex = upIndex;
                    });

                } else if (upevt.ctrlKey && this.multiSelect) {
                    this.currentItemIndex = upIndex;
                    this.toggleSelect$([upItem], !upItem.selected)
                        .first()
                        .subscribe(() => this.changeDetectorRef.markForCheck());
                }

                this.rangeStartIndex = -1;
            });
    }

    protected getDragContext(index: number) {
        if (!this.sortable && !this.itemsDraggable) {
            return null;
        }

        return {
            dragendcallback: (event: IDejaDragEvent) => {
                this.itemDragEnd.emit(event);
                delete this._ddStartIndex;
                delete this._ddTargetIndex;
                this.calcViewPort$().first().subscribe(noop); // Comment this line to debug dragdrop
            },
            dragstartcallback: (event: IDejaDragEvent) => {
                const targetIndex = this.getItemIndexFromHTMLElement(event.target as HTMLElement);
                if (targetIndex === undefined) {
                    return;
                }
                this._ddStartIndex = index;
                event.dragObject = this._itemList[targetIndex - this.vpStartRow];
                this.itemDragStart.emit(event);
            },
            object: {
                index: index,
            },
        };
    }

    protected getDropContext() {
        if (!this.sortable) {
            return null;
        }

        return {
            dragovercallback: (event: IDejaDragEvent) => {
                if (this._ddStartIndex === undefined) {
                    return;
                }

                const targetIndex = this.getItemIndexFromHTMLElement(event.target as HTMLElement);
                if (targetIndex === undefined) {
                    return;
                }

                // Faire calculer le target final en fonction de la hierarchie par le service
                this.calcDragTargetIndex$(this._ddStartIndex, targetIndex)
                    .switchMap((finalTarget) => {
                        if (finalTarget !== undefined && finalTarget !== this._ddTargetIndex) {
                            this._ddTargetIndex = finalTarget;
                            return this.calcViewPort$().map(() => finalTarget);
                        } else {
                            return Observable.of(finalTarget);
                        }
                    })
                    .subscribe(noop);

                event.preventDefault();
                return;
            },
            dropcallback: (event: IDejaDragEvent) => {
                delete this._ddStartIndex;
                delete this._ddTargetIndex;
                this.drop$()
                    .switchMap(() => this.calcViewPort$())
                    .subscribe(noop);
                event.preventDefault();
            },
        };
    }

    protected dragLeave(event: DragEvent) {
        const listRect = this.listcontainer.nativeElement.getBoundingClientRect();

        const listBounds = Rect.fromLTRB(listRect.left,
            listRect.top,
            listRect.right,
            listRect.bottom);

        if (!listBounds.containsPoint(new Position(event.pageX, event.pageY))) {
            this._ddTargetIndex = this._ddStartIndex;
            this.calcViewPort$().first().subscribe(noop);
        }
    }

    protected onSelectionChange() {
        const e = this.multiSelect ? { items: this.selectedItems } as DejaTreeListItemsEvent : { item: this.selectedItems[0] } as DejaTreeListItemEvent;
        this.selectedChange.emit(e);
    }

    protected selectRange$(indexFrom: number, indexTo?: number): Observable<number> {
        return super.selectRange$(indexFrom, indexTo).do((selectedCount) => {
            if (selectedCount) {
                // Raise event
                this.onSelectionChange();
            }
            return selectedCount;
        }).do(() => this.changeDetectorRef.markForCheck());
    }

    protected toggleSelect$(items: IItemBase[], state: boolean): Observable<IItemBase[]> {
        if (!this._multiSelect && items[0].selected === state) {
            return Observable.of(items);
        } else {
            return super.toggleSelect$(items, state)
                .do(() => {
                    // Raise event
                    this.onSelectionChange();
                });
        }
    }

    protected calcViewPort$() {
        return super.calcViewPort$(this.query, this.maxHeight, this.listcontainer.nativeElement)
            .do((res: IViewPort) => {
                // Prevent that the adaptation of the scroll raise a new view port calculation
                this.ignoreNextScrollEvents = res.outOfRange;
                if (this.rowsCount > 0 && this.afterViewInit) {
                    this.afterViewInit.emit();
                    this.afterViewInit = null;
                }
                this.changeDetectorRef.markForCheck();
            });
    }
}
