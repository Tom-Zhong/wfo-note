import { Formatter } from "./Formatter";

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
    static checkExistAndSave(key: string, dateArr: Date[]) {
        // console.log('StorageUtils.checkExistAndSave called with key:', key, 'and dateArr:', dateArr);
        dateArr.forEach(date => {
            // console.log('Checking existence and saving for date:', date);
            const formattedDate = Formatter.formatDateToString(date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            let storageDays = StorageUtils.load(key);
            // console.log('storageDays:', month, year);
            if (storageDays && storageDays['' + year + '-' + month]) {
                if (storageDays['' + year + '-' + month].includes(formattedDate)) {
                    return;
                }

                storageDays['' + year + '-' + month].push(formattedDate);
            } else {
                if (!storageDays) {
                    storageDays = {};
                }
                storageDays['' + year + '-' + month] = [formattedDate];
            }
            StorageUtils.save(key, storageDays);
        });
    }

    static checkExistAndRemove(key: string, dateArr: Date[]) {
        dateArr.forEach(date => {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            let storageDays = StorageUtils.load(key);
            console.log('storageDays before remove:', storageDays);
            if (storageDays && storageDays['' + year + '-' + month]) {
                // Remove date from array
                storageDays['' + year + '-' + month] = storageDays['' + year + '-' + month].filter((dateStr: string) => dateStr !== Formatter.formatDateToString(date));
                StorageUtils.save(key, storageDays);
            }
        });
    }
};