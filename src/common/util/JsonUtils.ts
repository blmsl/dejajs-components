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

export class JsonUtils {
    /**
     * deserializeJson is a method to deserialize a json into a typed object. The <T> say that we want to "capture" the object type so we can return it.
     * More details : https://www.typescriptlang.org/docs/handbook/generics.html
     *
     * /!\ this is not a recursive function !
     *      Object into object will stay as generic objects.
     *      Re-use this function to deserialize them into typed objects.
     *
     * Usage : var obj = JsonUtils.deserializeJson(new TypedObj(), aJSON);
     *          Where TypedObj is a valid TypeScript class.
     *          After that, obj.constructor.name will be TypedObj
     * {
     * Example of use : http://plnkr.co/edit/11b0kzypP0N9I9B8AqPx?p=preview
     *
     * @param {Object} obj : Object to deserialize into
     * @param {Object | string} jsonObj : a JSON;
     *
     * @return {<T>} obj : an object of "T" type
     */
    public static deserializeJson<T>(obj: T, jsonObj: any): T {

        if (typeof jsonObj === "string") {
            jsonObj = JSON.parse(jsonObj);
        }

        Object.keys(jsonObj).forEach((propName) => {
            if (!(jsonObj[propName] instanceof Object)) {
                obj[propName] = jsonObj[propName];
            }
        });

        return obj;
    }

    /**
     * DeserializeJson is a method to deserialize a json into a typed object. The instance is created during the call. Not a recursive.
     * <p> Exemple:
     *     <code>let newObj:MyClass = deserializeJson<MyClass>(MyClass>,jsonObj);</code>
     * </p>
     * <p>note: It's possible than The object generate can old more properties than the one in the class</p>
     * <p>note2: Require an empty constructor for the serialized class</p>
     * @param clazz The class of the object created
     * @param sourceObj The JSON object
     * @param caseTransform
     * @returns {T} : An object of "T" type
     */
    public static deserializeJson2<T>(clazz: {new (): T}, sourceObj: any, caseTransform: boolean = false): T {
        let castedObj: T = new clazz();

        for (let sourcePropName in sourceObj) {
            if (sourceObj.hasOwnProperty(sourcePropName)) {
                let targetPropName = caseTransform ? sourcePropName.toLowerCase() : sourcePropName;
                castedObj[targetPropName] = sourceObj[sourcePropName];
            }
        }

        return castedObj;
    }

    /**
     * Like deserializeJson2, but for a list of objects
     * @param clazz
     * @param sourceList
     * @param caseTransform
     * @returns {any[]}
     */
    public static deserializeJsonList<T>(clazz: {new (): T}, sourceList: any[], caseTransform: boolean = false): T[] {
        return sourceList.map((sourceObj) => this.deserializeJson2<T>(clazz, sourceObj, caseTransform));
    }

    /**
     * Convert a list of object into a "Map Object" where attributes name are IDs and values are the objects
     * <br/>Note: the objects must have an "id" property
     * @param objList : List of object with an attribute "id" or "ID" or "Id"
     * @returns {any}
     */
    public static toMap(objList: any[]): any {
        let mapObj: any = {};
        objList.forEach((obj: any) => {
            mapObj[obj.id || obj.ID || obj.Id] = obj;
        });
        return mapObj;
    }

    /**
     * Cache for getOneFrom() method
     * @type {{}}
     */
    private static mapCaches: any = {};

    /**
     * Get an object from a array of object. It uses a cache in order to go faster if called in a loop.
     * @param listPromise Promise that returns a array of objects. Object Must have an an attribute "id" or "ID" or "Id"
     * @param id: The ID we want to get
     * @param cacheName: The cache key to store it
     * @returns {Promise<any>} One Promise with the selected element
     */
    public static getOneFrom(listPromise: Promise<any>, id: string, cacheName: string): Promise<any> {
        let currentcache = JsonUtils.mapCaches[cacheName];
        return new Promise<any>((resolve) => {
            if (id) {
                if (currentcache) {
                    resolve(currentcache[id]);
                } else {
                    listPromise.then((allObjs) => {
                        currentcache = JsonUtils.toMap(allObjs);
                        JsonUtils.mapCaches[cacheName] = currentcache;
                        resolve(currentcache[id]);
                    });
                }
            } else {
                resolve(null);
            }
        });
    }
}