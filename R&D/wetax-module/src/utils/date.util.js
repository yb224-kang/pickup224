"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitDateRange = splitDateRange;
const date_fns_1 = require("date-fns");
function splitDateRange(startDate, endDate, range, formatStr) {
    const result = [];
    let currentStart = (0, date_fns_1.startOfDay)(startDate);
    const finalEnd = (0, date_fns_1.endOfDay)(endDate);
    while ((0, date_fns_1.isBefore)(currentStart, finalEnd) ||
        currentStart.getTime() === finalEnd.getTime()) {
        let currentEnd;
        switch (range.type) {
            case "day":
                currentEnd = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)(currentStart, range.value - 1));
                break;
            case "week":
                const daysOfWeek = range.value * 7;
                currentEnd = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)(currentStart, daysOfWeek - 1));
                break;
            case "year":
                currentEnd = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)((0, date_fns_1.addYears)(currentStart, range.value), -1));
                break;
        }
        // 마지막 구간이 endDate를 초과하지 않도록 조정
        if ((0, date_fns_1.isAfter)(currentEnd, finalEnd)) {
            currentEnd = finalEnd;
        }
        result.push({
            startDate: currentStart,
            endDate: currentEnd,
        });
        // 다음 구간의 시작일 계산
        switch (range.type) {
            case "day":
                currentStart = (0, date_fns_1.startOfDay)((0, date_fns_1.addDays)(currentStart, range.value));
                break;
            case "week":
                currentStart = (0, date_fns_1.startOfDay)((0, date_fns_1.addWeeks)(currentStart, range.value));
                break;
            case "year":
                currentStart = (0, date_fns_1.startOfDay)((0, date_fns_1.addYears)(currentStart, range.value));
                break;
        }
        // 마지막 구간을 추가했으면 종료
        if (currentEnd.getTime() === finalEnd.getTime()) {
            break;
        }
    }
    if (formatStr) {
        return result.map((item) => ({
            startDate: (0, date_fns_1.format)(item.startDate, formatStr),
            endDate: (0, date_fns_1.format)(item.endDate, formatStr),
        }));
    }
    return result;
}
