export class Formatter {
    static formatDateToString(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    // 计算当前日期在本月的第几周
    static getWeekNumber(date: Date) {
        return Math.ceil((date.getDate() + (new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1)) / 7);
    }

    // 获取指定日期一共有几周
    static getWeeksInMonth(date: Date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const weekday = firstDay.getDay();
        const days = lastDay.getDate();
        return Math.ceil((days + weekday - 1) / 7);
    }
}