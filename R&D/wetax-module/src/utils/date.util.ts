import {
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isAfter,
  isBefore,
  format,
} from "date-fns";

type DateRangeType = "day" | "week" | "month" | "year";

// 함수 오버로드: formatStr이 없을 때 Date 배열 반환
export function splitDateRange(
  startDate: Date,
  endDate: Date,
  range: { type: DateRangeType; value: number }
): { startDate: Date; endDate: Date }[];

// 함수 오버로드: formatStr이 있을 때 string 배열 반환
export function splitDateRange(
  startDate: Date,
  endDate: Date,
  range: { type: DateRangeType; value: number },
  formatStr: string
): { startDate: string; endDate: string }[];

export function splitDateRange(
  startDate: Date,
  endDate: Date,
  range: { type: DateRangeType; value: number },
  formatStr?: string
):
  | { startDate: Date; endDate: Date }[]
  | { startDate: string; endDate: string }[] {
  const result: { startDate: Date; endDate: Date }[] = [];
  let currentStart = startOfDay(startDate);
  const finalEnd = endOfDay(endDate);

  while (
    isBefore(currentStart, finalEnd) ||
    currentStart.getTime() === finalEnd.getTime()
  ) {
    let currentEnd: Date;

    switch (range.type) {
      case "day":
        currentEnd = endOfDay(addDays(currentStart, range.value - 1));
        break;
      case "week":
        const daysOfWeek = range.value * 7;
        currentEnd = endOfDay(addDays(currentStart, daysOfWeek - 1));
        break;
      case "month":
        currentEnd = endOfDay(addDays(addMonths(currentStart, range.value), -1));
        break;
      case "year":
        currentEnd = endOfDay(addDays(addYears(currentStart, range.value), -1));
        break;
    }

    // 마지막 구간이 endDate를 초과하지 않도록 조정
    if (isAfter(currentEnd, finalEnd)) {
      currentEnd = finalEnd;
    }

    result.push({
      startDate: currentStart,
      endDate: currentEnd,
    });

    // 다음 구간의 시작일 계산
    switch (range.type) {
      case "day":
        currentStart = startOfDay(addDays(currentStart, range.value));
        break;
      case "week":
        currentStart = startOfDay(addWeeks(currentStart, range.value));
        break;
      case "month":
        currentStart = startOfDay(addMonths(currentStart, range.value));
        break;
      case "year":
        currentStart = startOfDay(addYears(currentStart, range.value));
        break;
    }

    // 마지막 구간을 추가했으면 종료
    if (currentEnd.getTime() === finalEnd.getTime()) {
      break;
    }
  }

  if (formatStr) {
    return result.map((item) => ({
      startDate: format(item.startDate, formatStr),
      endDate: format(item.endDate, formatStr),
    }));
  }

  return result;
}

