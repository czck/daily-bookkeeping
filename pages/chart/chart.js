// pages/chart/chart.js
const { getBills } = require('../../utils/storage.js');
const { 
  aggregateBillsByWeek, 
  aggregateBillsByMonth, 
  isDateInThisWeek, 
  isDateInThisMonth, 
  getWeekInfo,
  parseToDate
} = require('../../utils/date_helper.js');

const PALETTE = [
  '#07C160', // 微信绿
  '#f59e0b', // 琥珀黄
  '#6366f1', // 靛青蓝
  '#f43f5e', // 玫瑰红
  '#0ea5e9', // 天空蓝
  '#8b5cf6', // 罗兰紫
  '#10b981', // 翡翠绿
  '#64748b'  // 暖灰
];

Page({
  data: {
    bills: [],
    
    // 顶部三联统计指标
    thisWeekTotal: '0.00',
    thisMonthTotal: '0.00',
    thisMonthDailyAvg: '0.00',
    currentWeekLabel: '',
    currentMonthLabel: '',
    
    totalExpense: '0.00',
    totalCount: 0,
    topCategoryName: '',
    
    // 走势图切换维度：day (按日) | week (按周) | month (按月)
    trendDimension: 'day',
    // 排序模式：time (按时间先后，默认) | amount (按消费金额从高到低)
    sortMode: 'time',
    currentTrendTitle: '每日开销走势',
    currentTrendSummary: '',
    currentTrendList: [],
    chartScrollLeft: 99999,

    categories: [],
    habitTags: []
  },

  onShow() {
    this.loadAndComputeStats();
  },

  onPullDownRefresh() {
    this.loadAndComputeStats();
    wx.stopPullDownRefresh();
  },

  switchTrendDimension(e) {
    const dim = e.currentTarget.dataset.dim || 'day';
    this.setData({ trendDimension: dim }, () => {
      this.updateActiveTrendDisplay();
    });
  },

  switchSortMode(e) {
    const mode = e.currentTarget.dataset.mode || 'time';
    if (mode === this.data.sortMode) return;
    this.setData({ sortMode: mode }, () => {
      this.updateActiveTrendDisplay();
    });
  },

  updateActiveTrendDisplay() {
    const dim = this.data.trendDimension || 'day';
    const sortMode = this.data.sortMode || 'time';
    if (!this._trendStore || !this._trendStore[dim]) return;

    const activeTrend = this._trendStore[dim];
    const list = sortMode === 'amount' ? activeTrend.amountList : activeTrend.timeList;
    const scrollLeft = sortMode === 'amount' ? 0 : 99999;

    this.setData({
      currentTrendTitle: activeTrend.title,
      currentTrendSummary: activeTrend.summary,
      currentTrendList: list,
      chartScrollLeft: scrollLeft
    });
  },

  loadAndComputeStats() {
    const list = getBills();
    const now = new Date();
    const currentWeekInfo = getWeekInfo(now);

    // 1. 本周 / 本月核心数据
    let thisWeekExpense = 0;
    let thisMonthExpense = 0;
    let thisMonthDays = 0;

    // 2. 统计品类与打卡
    let totalExpense = 0;
    let itemCount = 0;
    const catMap = {};
    const habitMap = {};

    list.forEach(g => {
      const amt = g.total || 0;
      totalExpense += amt;
      if (isDateInThisWeek(g.date, now)) {
        thisWeekExpense += amt;
      }
      if (isDateInThisMonth(g.date, now)) {
        thisMonthExpense += amt;
        thisMonthDays++;
      }

      // 聚合品类
      if (g.items && Array.isArray(g.items)) {
        g.items.forEach(it => {
          itemCount++;
          const name = it.name || '其他';
          const cleanName = name.replace(/\s*\(.*?\)/, '').trim();
          if (!catMap[cleanName]) {
            catMap[cleanName] = { 
              name: cleanName, 
              emoji: it.emoji || '🏷️', 
              amount: 0, 
              count: 0 
            };
          }
          catMap[cleanName].amount += (it.amount || 0);
          catMap[cleanName].count += 1;
        });
      }

      // 完全动态聚合所有自定义打卡项
      if (g.tags && Array.isArray(g.tags)) {
        g.tags.forEach(t => {
          if (!habitMap[t]) {
            habitMap[t] = { name: t, count: 0, dates: [] };
          }
          habitMap[t].count += 1;
          habitMap[t].dates.push(g.date);
        });
      }
    });

    const thisMonthDailyAvg = thisMonthDays > 0 ? (thisMonthExpense / thisMonthDays).toFixed(2) : '0.00';

    // 3. 构建【按日】走势：严格按日期升序 (从早到晚)
    const sortedDays = list.slice().sort((a, b) => {
      return parseToDate(a.date).getTime() - parseToDate(b.date).getTime();
    });
    let maxDayAmt = 0;
    let minDayAmt = Infinity;
    let maxDayObj = null;
    let minDayObj = null;

    sortedDays.forEach(g => {
      const amt = g.total || 0;
      if (amt > maxDayAmt) {
        maxDayAmt = amt;
        maxDayObj = { label: g.date, amount: amt.toFixed(2) };
      }
      if (amt < minDayAmt && amt > 0) {
        minDayAmt = amt;
        minDayObj = { label: g.date, amount: amt.toFixed(2) };
      }
    });

    const dailyTimeList = sortedDays.map(g => {
      const amt = g.total || 0;
      return {
        label: g.date,
        amount: amt.toFixed(2),
        rawAmount: amt,
        heightPercent: maxDayAmt > 0 ? Math.max(12, Math.round((amt / maxDayAmt) * 100)) : 10
      };
    });

    const dailyAmountList = sortedDays.slice().sort((a, b) => (b.total || 0) - (a.total || 0)).map(g => {
      const amt = g.total || 0;
      return {
        label: g.date,
        amount: amt.toFixed(2),
        rawAmount: amt,
        heightPercent: maxDayAmt > 0 ? Math.max(12, Math.round((amt / maxDayAmt) * 100)) : 10
      };
    });

    const dailySummary = (maxDayObj && minDayObj)
      ? `🔥 最高单日：${maxDayObj.label} (¥${maxDayObj.amount})   🌿 最低单日：${minDayObj.label} (¥${minDayObj.amount})`
      : '暂无趋势对比数据';

    // 4. 构建【按周】走势：严格按自然周升序，并归结同月份周用于绘制下方标识小横线
    const weeklyAgg = aggregateBillsByWeek(list);
    let maxWeekAmt = 0;
    let maxWeekObj = null;
    let totalWeeklyAmt = 0;
    weeklyAgg.forEach(w => {
      totalWeeklyAmt += w.rawAmount;
      if (w.rawAmount > maxWeekAmt) {
        maxWeekAmt = w.rawAmount;
        maxWeekObj = w;
      }
    });

    // 计算同月份各周分组 (用于小横线首尾判定与居中月份文字)
    let currentMKey = null;
    let currentGroup = [];
    const monthGroups = [];

    weeklyAgg.forEach(w => {
      if (w.monthKey !== currentMKey) {
        if (currentGroup.length > 0) {
          monthGroups.push(currentGroup);
        }
        currentGroup = [];
        currentMKey = w.monthKey;
      }
      currentGroup.push(w);
    });
    if (currentGroup.length > 0) {
      monthGroups.push(currentGroup);
    }

    monthGroups.forEach(grp => {
      const midIdx = Math.floor(grp.length / 2);
      grp.forEach((w, i) => {
        w.isFirstInMonth = (i === 0);
        w.isLastInMonth = (i === grp.length - 1);
        w.showMonthLabel = (i === midIdx);
      });
    });

    const weeklyTimeList = weeklyAgg.map(w => ({
      label: w.label,
      amount: w.amount,
      rawAmount: w.rawAmount,
      heightPercent: maxWeekAmt > 0 ? Math.max(12, Math.round((w.rawAmount / maxWeekAmt) * 100)) : 10,
      rangeText: w.rangeText,
      monthKey: w.monthKey,
      monthName: w.monthName,
      isFirstInMonth: w.isFirstInMonth,
      isLastInMonth: w.isLastInMonth,
      isSoloInMonth: (w.isFirstInMonth && w.isLastInMonth),
      showMonthLabel: w.showMonthLabel
    }));

    const weeklyAmountList = weeklyAgg.slice().sort((a, b) => b.rawAmount - a.rawAmount).map(w => ({
      label: w.label,
      amount: w.amount,
      rawAmount: w.rawAmount,
      heightPercent: maxWeekAmt > 0 ? Math.max(12, Math.round((w.rawAmount / maxWeekAmt) * 100)) : 10,
      rangeText: w.rangeText,
      monthKey: w.monthKey,
      monthName: w.monthName,
      isFirstInMonth: true,
      isLastInMonth: true,
      isSoloInMonth: true,
      showMonthLabel: true
    }));

    const weekAvg = weeklyAgg.length > 0 ? (totalWeeklyAmt / weeklyAgg.length).toFixed(2) : '0.00';
    const weeklySummary = maxWeekObj
      ? `🔥 消费最高周：${maxWeekObj.label} (¥${maxWeekObj.amount})   🌿 周均支出：¥${weekAvg}`
      : '暂无周对比数据';

    // 5. 构建【按月】走势
    const monthlyAgg = aggregateBillsByMonth(list);
    let maxMonthAmt = 0;
    let maxMonthObj = null;
    let totalMonthlyAmt = 0;
    monthlyAgg.forEach(m => {
      totalMonthlyAmt += m.rawAmount;
      if (m.rawAmount > maxMonthAmt) {
        maxMonthAmt = m.rawAmount;
        maxMonthObj = m;
      }
    });

    const monthlyTimeList = monthlyAgg.map(m => ({
      label: m.label,
      amount: m.amount,
      rawAmount: m.rawAmount,
      heightPercent: maxMonthAmt > 0 ? Math.max(12, Math.round((m.rawAmount / maxMonthAmt) * 100)) : 10
    }));

    const monthlyAmountList = monthlyAgg.slice().sort((a, b) => b.rawAmount - a.rawAmount).map(m => ({
      label: m.label,
      amount: m.amount,
      rawAmount: m.rawAmount,
      heightPercent: maxMonthAmt > 0 ? Math.max(12, Math.round((m.rawAmount / maxMonthAmt) * 100)) : 10
    }));

    const monthAvg = monthlyAgg.length > 0 ? (totalMonthlyAmt / monthlyAgg.length).toFixed(2) : '0.00';
    const monthlySummary = maxMonthObj
      ? `🔥 消费最高月：${maxMonthObj.label} (¥${maxMonthObj.amount})   🌿 月均支出：¥${monthAvg}`
      : '暂无月对比数据';

    this._trendStore = {
      day: {
        title: '每日开销走势',
        timeList: dailyTimeList,
        amountList: dailyAmountList,
        summary: dailySummary
      },
      week: {
        title: '每周开销走势对比',
        timeList: weeklyTimeList,
        amountList: weeklyAmountList,
        summary: weeklySummary
      },
      month: {
        title: '每月开销走势对比',
        timeList: monthlyTimeList,
        amountList: monthlyAmountList,
        summary: monthlySummary
      }
    };

    const curDim = this.data.trendDimension || 'day';
    const curSort = this.data.sortMode || 'time';
    const activeTrend = this._trendStore[curDim];
    const activeList = curSort === 'amount' ? activeTrend.amountList : activeTrend.timeList;
    const scrollLeft = curSort === 'amount' ? 0 : 99999;

    // 6. 品类列表排序
    const catList = Object.values(catMap).sort((a, b) => b.amount - a.amount);
    let colorIndex = 0;
    const categories = catList.map(c => {
      const pct = totalExpense > 0 ? ((c.amount / totalExpense) * 100).toFixed(1) : 0;
      const col = PALETTE[colorIndex % PALETTE.length];
      colorIndex++;
      return {
        name: c.name,
        emoji: c.emoji,
        amount: c.amount.toFixed(2),
        count: c.count,
        percent: pct,
        color: col
      };
    });

    // 7. 打卡列表排序
    const habitTags = Object.values(habitMap)
      .sort((a, b) => b.count - a.count)
      .map(h => ({
        name: h.name,
        count: h.count,
        datesText: h.dates.join('、')
      }));

    this.setData({
      bills: list,
      thisWeekTotal: thisWeekExpense.toFixed(2),
      thisMonthTotal: thisMonthExpense.toFixed(2),
      thisMonthDailyAvg,
      currentWeekLabel: currentWeekInfo.label,
      currentMonthLabel: `${now.getMonth() + 1}月`,

      totalExpense: totalExpense.toFixed(2),
      totalCount: itemCount,
      topCategoryName: categories.length > 0 ? `${categories[0].emoji} ${categories[0].name}` : '',
      
      currentTrendTitle: activeTrend.title,
      currentTrendSummary: activeTrend.summary,
      currentTrendList: activeList,
      chartScrollLeft: scrollLeft,
      
      categories,
      habitTags
    }, () => {
      this.drawPieChart(categories);
    });
  },

  drawPieChart(categories) {
    const query = wx.createSelectorQuery();
    query.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {});
        const dpr = windowInfo.pixelRatio || 2;
        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 12;
        const lineWidth = 16;

        if (!categories || categories.length === 0) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = '#e2e8f0';
          ctx.stroke();
          return;
        }

        let startAngle = -0.5 * Math.PI;

        categories.forEach(cat => {
          const sliceAngle = (parseFloat(cat.percent) / 100) * 2 * Math.PI;
          if (sliceAngle <= 0) return;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = cat.color;
          ctx.lineCap = 'butt';
          ctx.stroke();

          startAngle += sliceAngle;
        });
      });
  }
});
