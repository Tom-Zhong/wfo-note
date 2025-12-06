/**
 * Utility functions for storing and retrieving data from localStorage.
 */
export default class StorageUtils {
    static save(key: string, value: any) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    static load(key: string): any | null {
        const item = localStorage.getItem(key);
        if (item) {
            return JSON.parse(item);
        }
        return null;
    }
};