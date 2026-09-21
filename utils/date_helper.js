/**
 * 日期与时间聚合辅助工具类
 * 支持按周、按月分类归集，计算自然周与时间跨度
 */

/**
 * 将多种格式的日期解析为 Date 对象
 * 支持：'9.14', '9-14', '9月14日', '2026-09-14', '2026.09.14'
 */
function parseToDate(dateStr, referenceYear) {
  if (!dateStr) return new Date();
  const year = referenceYear || new Date().getFullYear();

  // 格式 1: 2026-09-14 或 2026.09.14
  const fullMatch = dateStr.match(/^(\d{4})[\.\-\/年](\d{1,2})[\.\-\/月](\d{1,2})/);
  if (fullMatch) {
    return new Date(parseInt(fullMatch[1], 10), parseInt(fullMatch[2], 10) - 1, parseInt(fullMatch[3], 10));
  }

  // 格式 2: 9.14 或 9月14日
  const shortMatch = dateStr.match(/(\d{1,2})[\.\-\/月](\d{1,2})/);
  if (shortMatch) {
    return new Date(year, parseInt(shortMatch[1], 10) - 1, parseInt(shortMatch[2], 10));
  }

  return new Date();
}

/**
 * 获取某个日期所在的自然周（周一作为每周第一天）
 * 返回：{ weekNum, year, label: '第38周', rangeText: '9.14-9.20' }
 */
function getWeekInfo(dateInput) {
  const d = dateInput instanceof Date ? new Date(dateInput) : parseToDate(dateInput);
  d.setHours(0, 0, 0, 0);

  // 调整为周一为一周起始 (周日 day 为 0)
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // 计算当年第几周 (基于每年的第一个周四)
  const targetThursday = new Date(monday);
  targetThursday.setDate(monday.getDate() + 3);
  const firstThursday = new Date(targetThursday.getFullYear(), 0, 4);
  const firstThursdayDay = firstThursday.getDay();
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() + ((firstThursdayDay === 0 ? -6 : 1) - firstThursdayDay));

  const weekNum = Math.round(((monday - firstMonday) / 86400000) / 7) + 1;
  const rangeText = `${monday.getMonth() + 1}.${monday.getDate()}-${sunday.getMonth() + 1}.${sunday.getDate()}`;

  return {
    weekNum,
    year: targetThursday.getFullYear(),
    weekKey: `${targetThursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    label: `第${weekNum}周`,
    rangeText,
    monday,
    sunday
  };
}

/**
 * 获取某个日期所在的月份信息
 * 返回：{ monthNum, monthKey: '2026-09', label: '9月' }
 */
function getMonthInfo(dateInput) {
  const d = dateInput instanceof Date ? new Date(dateInput) : parseToDate(dateInput);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return {
    year: y,
    monthNum: m,
    monthKey: `${y}-${String(m).padStart(2, '0')}`,
    label: `${m}月`
  };
}

/**
 * 判断是否属于本周
 */
function isDateInThisWeek(dateInput, now) {
  const targetDate = dateInput instanceof Date ? dateInput : parseToDate(dateInput);
  const refNow = now || new Date();
  const targetWeek = getWeekInfo(targetDate);
  const currentWeek = getWeekInfo(refNow);
  return targetWeek.weekKey === currentWeek.weekKey;
}

/**
 * 判断是否属于本月
 */
function isDateInThisMonth(dateInput, now) {
  const targetDate = dateInput instanceof Date ? dateInput : parseToDate(dateInput);
  const refNow = now || new Date();
  return targetDate.getFullYear() === refNow.getFullYear() && targetDate.getMonth() === refNow.getMonth();
}

/**
 * 将账单列表按自然周聚合
 */
function aggregateBillsByWeek(bills) {
  if (!bills || bills.length === 0) return [];
  const weekMap = {};

  bills.forEach(g => {
    const wInfo = getWeekInfo(g.date);
    if (!weekMap[wInfo.weekKey]) {
      weekMap[wInfo.weekKey] = {
        weekKey: wInfo.weekKey,
        label: wInfo.label,
        rangeText: wInfo.rangeText,
        total: 0,
        count: 0,
        days: new Set(),
        habitsCount: 0,
        sortTime: wInfo.monday.getTime(),
        monday: wInfo.monday,
        sunday: wInfo.sunday
      };
    }
    const item = weekMap[wInfo.weekKey];
    item.total += (g.total || 0);
    item.count += (g.items ? g.items.length : 0);
    item.days.add(g.date);
    if (g.tags && Array.isArray(g.tags)) {
      item.habitsCount += g.tags.length;
    }
  });

  const list = Object.values(weekMap).sort((a, b) => a.sortTime - b.sortTime);
  return list.map(w => {
    const thursday = new Date(w.monday.getTime() + 3 * 86400000);
    const monthNum = thursday.getMonth() + 1;
    const monthKey = `${thursday.getFullYear()}-${monthNum}`;
    const monthName = `${monthNum}月`;
    return {
      weekKey: w.weekKey,
      label: w.label,
      rangeText: w.rangeText,
      amount: (Math.round(w.total * 100) / 100).toFixed(2),
      rawAmount: Math.round(w.total * 100) / 100,
      count: w.count,
      recordDays: w.days.size,
      habitsCount: w.habitsCount,
      monday: w.monday,
      sunday: w.sunday,
      monthNum,
      monthKey,
      monthName
    };
  });
}

/**
 * 将账单列表按月份聚合
 */
function aggregateBillsByMonth(bills) {
  if (!bills || bills.length === 0) return [];
  const monthMap = {};

  bills.forEach(g => {
    const mInfo = getMonthInfo(g.date);
    if (!monthMap[mInfo.monthKey]) {
      monthMap[mInfo.monthKey] = {
        monthKey: mInfo.monthKey,
        label: mInfo.label,
        year: mInfo.year,
        total: 0,
        count: 0,
        days: new Set(),
        habitsCount: 0,
        sortTime: new Date(mInfo.year, mInfo.monthNum - 1, 1).getTime()
      };
    }
    const item = monthMap[mInfo.monthKey];
    item.total += (g.total || 0);
    item.count += (g.items ? g.items.length : 0);
    item.days.add(g.date);
    if (g.tags && Array.isArray(g.tags)) {
      item.habitsCount += g.tags.length;
    }
  });

  const list = Object.values(monthMap).sort((a, b) => a.sortTime - b.sortTime);
  return list.map(m => ({
    monthKey: m.monthKey,
    label: m.label,
    year: m.year,
    amount: (Math.round(m.total * 100) / 100).toFixed(2),
    rawAmount: Math.round(m.total * 100) / 100,
    count: m.count,
    recordDays: m.days.size,
    habitsCount: m.habitsCount
  }));
}

/**
 * 获取某个日期在所属月份的“第几周”（如：9月第1周、9月第2周...）
 */
function getMonthWeekInfo(dateInput) {
  const d = dateInput instanceof Date ? new Date(dateInput) : parseToDate(dateInput);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  // 该日期所在的自然周 (周一作为每周起始)
  const wInfo = getWeekInfo(d);

  // 当月 1 号所在周
  const firstDayOfMonth = new Date(y, m - 1, 1);
  const firstWeekInfo = getWeekInfo(firstDayOfMonth);

  // 计算相差的周数
  const diffWeeks = Math.round((wInfo.monday.getTime() - firstWeekInfo.monday.getTime()) / (7 * 86400000));
  const monthWeekNum = Math.max(1, diffWeeks + 1);

  return {
    year: y,
    monthNum: m,
    monthWeekNum,
    weekKey: `${y}-${String(m).padStart(2, '0')}-W${monthWeekNum}`,
    weekTitle: `${m}月第${monthWeekNum}周`,
    rangeText: wInfo.rangeText,
    monday: wInfo.monday,
    sunday: wInfo.sunday
  };
}

module.exports = {
  parseToDate,
  getWeekInfo,
  getMonthInfo,
  getMonthWeekInfo,
  isDateInThisWeek,
  isDateInThisMonth,
  aggregateBillsByWeek,
  aggregateBillsByMonth
};

