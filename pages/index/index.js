const { 
  getBills, 
  getCustomHabits,
  addCustomHabit,
  deleteCustomHabit,
  getCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
  addDirectBill, 
  addDirectBook, 
  addDirectTravel, 
  addDirectHabit, 
  addBillGroups,
  deleteBillGroup, 
  updateBillItem,
  deleteBillItem,
  deleteLifeBlock,
  updateLifeBlock,
  deleteDayHabit,
  updateDayHabits,
  exportBillsAsText,
  cleanTestData,
  clearAllBills
} = require('../../utils/storage.js');
const { parseBillText } = require('../../utils/parser.js');
const { SIX_MONTHS_RAW_TEXT } = require('../../utils/sample_six_months.js');
const { 
  subscribeSyncStatus, 
  manualUpload, 
  manualDownload, 
  autoSyncOnLaunch 
} = require('../../utils/cloud_sync.js');
const { 
  isDateInThisWeek, 
  isDateInThisMonth, 
  getWeekInfo,
  getMonthInfo,
  getMonthWeekInfo,
  parseToDate
} = require('../../utils/date_helper.js');

const PRESET_CATEGORIES = [
  { name: '早饭', emoji: '🍳', type: 'breakfast' },
  { name: '午饭', emoji: '🍱', type: 'lunch' },
  { name: '晚饭', emoji: '🍲', type: 'dinner' },
  { name: '夜宵', emoji: '🍢', type: 'snack' },
  { name: '美团小象超市', emoji: '🛒', type: 'market' },
  { name: '购物平台', emoji: '🛍️', type: 'shopping' },
  { name: '饮品咖啡', emoji: '☕', type: 'drink' },
  { name: '打车交通', emoji: '🚖', type: 'traffic' },
  { name: '水果零食', emoji: '🍎', type: 'fruit' },
  { name: '房租', emoji: '🏠', type: 'rent' },
  { name: '水电费', emoji: '💡', type: 'utilities' }
];

const CUSTOM_CATEGORY_ITEM = { name: '自定义', emoji: '➕', type: 'custom', isCustom: false };

const CUSTOM_EMOJI_LIST = [
  '🏷️', '🎬', '🎮', '💇', '🐱', '🐶', '🏠', '💊', 
  '🏋️', '🎁', '💐', '🎂', '🚗', '✈️', '📚', '💻', 
  '🎤', '🏊', '🧺', '🔌', '💅', '👶', '📦', '💰', 
  '🌟', '💈', '☕', '🍜', '🍔', '🍺', '🛍️', '🧼'
];

const HABIT_EMOJI_LIST = [
  '⚡', '🏃', '🌙', '💧', '😊', '🧘', '📚', '🚴', 
  '🏋️', '💪', '🍎', '💊', '☕', '🎨', '🎸', '✍️', 
  '🧹', '🪴', '🎯', '✨', '🔥', '💤', '🚭', '🚶', 
  '🏊', '💰', '🎧', '🥑', '🧗', '🥊', '⚽', '🎮'
];

Page({
  data: {
    bills: [],
    monthTotal: '0.00',
    recordDays: 0,
    avgDaily: '0.00',
    habitTotalCount: 0,
    currentMonthText: '', // 动态当前月份
    currentWeekText: '', // 动态当前周数
    
    // 时间维度切换：week (本周) | month (本月) | all (全部)
    currentScope: 'week',
    scopeTitle: '本周开销与生活手记',
    scopeTotalAmount: '0.00',
    scopeSubtitle: '包含 0 笔消费',
    scopeDays: 0,
    scopeAvg: '0.00',
    scopeHabits: 0,

    // 月份浏览导航状态 (支持左右滑动与按钮切换)
    viewYear: 2026,
    viewMonth: 9,
    prevMonthLabel: '8月',
    nextMonthLabel: '10月',

    // 时间轴按周期折叠数据 (二级树形折叠：月 -> 周 -> 天)
    groupedTimeline: [],
    isAllTimelineCollapsed: false,

    // 文本导入弹窗状态
    showImportModal: false,
    importRawText: '',

    // 录入弹窗状态：记账排在最前
    showAddModal: false,
    currentMode: 'bill',

    // 日期选择
    selectedDateString: '',
    selectedDateShort: '',
    selectedDateDisplay: '',

    // 记账输入
    billAmount: '',
    billRemark: '',
    presetCategories: [],
    customCategories: [],
    selectedCategory: PRESET_CATEGORIES[0],
    customCategoryName: '', // 自定义分类名称输入
    customCategoryEmoji: '🏷️', // 自定义分类选中的小表情
    customEmojiList: CUSTOM_EMOJI_LIST, // 丰富小表情库

    // 自定义打卡项列表与输入
    customHabits: [],
    newHabitName: '',
    newHabitEmoji: '⚡', // 打卡小表情选定
    habitEmojiList: HABIT_EMOJI_LIST,

    // 读书随记输入
    bookTitle: '',
    bookProgress: '',
    bookQuote: '',

    // 旅游随记输入
    travelLocation: '',
    travelTag: '周末漫游',
    travelNotes: '',

    // 账单条目修改弹窗状态
    showEditModal: false,
    editingGroupId: '',
    editingItemId: '',
    editAmount: '',
    editCategory: PRESET_CATEGORIES[0],
    editCustomCategoryName: '',
    editCustomCategoryEmoji: '🏷️',
    editRemark: '',
    editDateString: '',
    editDateShort: '',
    editDateDisplay: '',

    // 读书随记修改弹窗状态
    showEditBookModal: false,
    editBookGroupId: '',
    editBookTitle: '',
    editBookProgress: '',
    editBookQuote: '',
    editBookDateString: '',
    editBookDateShort: '',
    editBookDateDisplay: '',

    // 旅途漫记修改弹窗状态
    showEditTravelModal: false,
    editTravelGroupId: '',
    editTravelLocation: '',
    editTravelTag: '',
    editTravelNotes: '',
    editTravelDateString: '',
    editTravelDateShort: '',
    editTravelDateDisplay: '',

    // 打卡修改弹窗状态
    showEditHabitModal: false,
    editHabitGroupId: '',
    editHabitSelectedTags: [],
    editHabitSelectedMap: {},
    editHabitAvailableTags: [],
    editHabitDateString: '',
    editHabitDateShort: '',
    editHabitDateDisplay: '',

    // 微信云端同步状态
    cloudStatus: {
      connected: false,
      statusText: '正在连接微信云端...',
      lastSyncTime: '',
      isSyncing: false
    }
  },

  onLoad() {
    this.loadCategories();
    this.initTodayDate();
    this.refreshData();

    // 订阅微信云端同步状态变更
    subscribeSyncStatus((status) => {
      this.setData({ cloudStatus: status });
    });
  },

  onShow() {
    this.loadCategories();
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData();
    autoSyncOnLaunch((success, hasNewData) => {
      if (hasNewData) {
        this.refreshData();
      }
      wx.stopPullDownRefresh();
    });
  },

  initTodayDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${d}`;
    const short = `${now.getMonth() + 1}.${now.getDate()}`;
    this.setData({
      selectedDateString: ymd,
      selectedDateShort: short,
      selectedDateDisplay: `今天 (${now.getMonth() + 1}月${now.getDate()}日)`
    });
  },

  onDateChange(e) {
    const ymd = e.detail.value;
    const parts = ymd.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const short = `${m}.${d}`;
    this.setData({
      selectedDateString: ymd,
      selectedDateShort: short,
      selectedDateDisplay: `${m}月${d}日`
    });
  },

  getAdjacentMonth(year, month, delta) {
    let m = month + delta;
    let y = year;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    return { year: y, month: m, label: `${m}月` };
  },

  changeMonth(delta) {
    const { viewYear, viewMonth } = this.data;
    const next = this.getAdjacentMonth(viewYear, viewMonth, delta);
    const prevInfo = this.getAdjacentMonth(next.year, next.month, -1);
    const nextInfo = this.getAdjacentMonth(next.year, next.month, 1);

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) {}

    this.setData({
      viewYear: next.year,
      viewMonth: next.month,
      prevMonthLabel: prevInfo.label,
      nextMonthLabel: nextInfo.label
    }, () => {
      this.refreshData();
    });
  },

  handlePrevMonth() {
    this.changeMonth(-1);
  },

  handleNextMonth() {
    this.changeMonth(1);
  },

  onTouchStart(e) {
    if (e.touches && e.touches.length > 0) {
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
      this._touchStartTime = Date.now();
    }
  },

  onTouchEnd(e) {
    if (this._touchStartX === null || this._touchStartX === undefined) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;
    const dt = Date.now() - (this._touchStartTime || 0);

    this._touchStartX = null;
    this._touchStartY = null;

    // 仅在明确的横向滑动（距离大于50px且横向位移大于纵向位移1.4倍，时间短于800ms）触发
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) {
      if (this.data.currentScope !== 'month') {
        this.setData({ currentScope: 'month' });
      }
      if (dx > 0) {
        // 向右滑 -> 切换到上一月
        this.changeMonth(-1);
      } else {
        // 向左滑 -> 切换到下一月
        this.changeMonth(1);
      }
    }
  },

  refreshData() {
    const list = getBills();
    const habits = getCustomHabits();
    const now = new Date();
    const wInfo = getWeekInfo(now);

    const viewYear = this.data.viewYear || now.getFullYear();
    const viewMonth = this.data.viewMonth || (now.getMonth() + 1);

    const prevMonthObj = this.getAdjacentMonth(viewYear, viewMonth, -1);
    const nextMonthObj = this.getAdjacentMonth(viewYear, viewMonth, 1);

    // 1. 全部统计
    let allTotal = 0;
    let allItemCount = 0;
    let allHabitCount = 0;
    list.forEach(g => {
      allTotal += (g.total || 0);
      if (g.items) allItemCount += g.items.length;
      if (g.tags && Array.isArray(g.tags)) allHabitCount += g.tags.length;
    });
    const allDays = list.length;
    const allAvg = allDays > 0 ? (allTotal / allDays).toFixed(2) : '0.00';

    // 2. 当前选中月份统计 (根据 viewYear, viewMonth)
    const targetMonthDate = new Date(viewYear, viewMonth - 1, 1);
    const monthList = list.filter(g => isDateInThisMonth(g.date, targetMonthDate));
    let monthTotal = 0;
    let monthItemCount = 0;
    let monthHabitCount = 0;
    monthList.forEach(g => {
      monthTotal += (g.total || 0);
      if (g.items) monthItemCount += g.items.length;
      if (g.tags && Array.isArray(g.tags)) monthHabitCount += g.tags.length;
    });
    const monthDays = monthList.length;
    const monthAvg = monthDays > 0 ? (monthTotal / monthDays).toFixed(2) : '0.00';

    // 3. 本周统计
    const weekList = list.filter(g => isDateInThisWeek(g.date, now));
    let weekTotal = 0;
    let weekItemCount = 0;
    let weekHabitCount = 0;
    weekList.forEach(g => {
      weekTotal += (g.total || 0);
      if (g.items) weekItemCount += g.items.length;
      if (g.tags && Array.isArray(g.tags)) weekHabitCount += g.tags.length;
    });
    const weekDays = weekList.length;
    const weekAvg = weekDays > 0 ? (weekTotal / weekDays).toFixed(2) : '0.00';

    const isCurrentMonth = (viewYear === now.getFullYear() && viewMonth === (now.getMonth() + 1));

    this._scopesData = {
      month: {
        title: `${viewYear}年${viewMonth}月开销与生活手记`,
        total: monthTotal.toFixed(2),
        sub: `${isCurrentMonth ? '本月' : viewMonth + '月'}共 ${monthItemCount} 笔消费`,
        days: monthDays,
        avg: monthAvg,
        habits: monthHabitCount
      },
      week: {
        title: `本周开销 (${wInfo.rangeText})`,
        total: weekTotal.toFixed(2),
        sub: `${wInfo.label} · 共 ${weekItemCount} 笔消费`,
        days: weekDays,
        avg: weekAvg,
        habits: weekHabitCount
      },
      all: {
        title: `${now.getFullYear()}年度累计生活手记`,
        total: allTotal.toFixed(2),
        sub: `累计 ${allItemCount} 笔消费`,
        days: allDays,
        avg: allAvg,
        habits: allHabitCount
      }
    };

    const curScope = this.data.currentScope || 'week';
    const activeData = this._scopesData[curScope] || this._scopesData.week;
    const groupedTimeline = this.buildGroupedTimeline(list, curScope, viewYear, viewMonth);
    const isAllTimelineCollapsed = this.checkAllCollapsed(groupedTimeline);

    this.setData({
      bills: list,
      groupedTimeline,
      isAllTimelineCollapsed,
      customHabits: habits,
      currentMonthText: `${now.getMonth() + 1}月`,
      currentWeekText: `${wInfo.label}`,
      viewYear,
      viewMonth,
      prevMonthLabel: prevMonthObj.label,
      nextMonthLabel: nextMonthObj.label,
      monthTotal: monthTotal.toFixed(2),
      recordDays: monthDays,
      avgDaily: monthAvg,
      habitTotalCount: monthHabitCount,

      scopeTitle: activeData.title,
      scopeTotalAmount: activeData.total,
      scopeSubtitle: activeData.sub,
      scopeDays: activeData.days,
      scopeAvg: activeData.avg,
      scopeHabits: activeData.habits
    });
  },

  /**
   * 将手账列表按时间维度聚合为二级树形折叠分组 (月 -> 周 -> 日)
   */
  buildGroupedTimeline(list, currentScope, viewYear, viewMonth) {
    if (!list || list.length === 0) return [];

    const now = new Date();
    viewYear = viewYear || now.getFullYear();
    viewMonth = viewMonth || (now.getMonth() + 1);

    if (!this._collapsedState) {
      this._collapsedState = {};
    }

    function formatDaysList(days) {
      if (!days) return [];
      return days.map(day => {
        const numTotal = typeof day.total === 'number' ? day.total : parseFloat(day.total) || 0;
        const formattedItems = (day.items || []).map(it => {
          const numAmt = typeof it.amount === 'number' ? it.amount : parseFloat(it.amount) || 0;
          return {
            id: it.id,
            name: it.name,
            amount: it.amount,
            amountDisplay: (Math.round(numAmt * 100) / 100).toFixed(2),
            emoji: it.emoji,
            tag: it.tag,
            type: it.type
          };
        });
        return {
          id: day.id,
          date: day.date,
          dateDisplay: day.dateDisplay,
          weekday: day.weekday,
          total: day.total,
          totalDisplay: (Math.round(numTotal * 100) / 100).toFixed(2),
          items: formattedItems,
          book: day.book,
          travel: day.travel,
          tags: day.tags
        };
      });
    }

    if (currentScope === 'week') {
      const weekList = list.filter(g => isDateInThisWeek(g.date, now));
      if (weekList.length === 0) return [];

      const wInfo = getWeekInfo(now);
      let totalAmount = 0;
      let itemCount = 0;
      weekList.forEach(d => {
        totalAmount += (d.total || 0);
        if (d.items) itemCount += d.items.length;
      });

      const wkKey = wInfo.weekKey;
      const isWkCollapsed = typeof this._collapsedState[wkKey] === 'boolean' ? this._collapsedState[wkKey] : false;

      return [{
        key: 'scope-week',
        title: `本周 · ${wInfo.label}`,
        totalAmount: (Math.round(totalAmount * 100) / 100).toFixed(2),
        daysCount: weekList.length,
        itemCount: itemCount,
        collapsed: false,
        weeks: [{
          key: wkKey,
          title: `本周 · ${wInfo.label}`,
          rangeText: wInfo.rangeText,
          totalAmount: (Math.round(totalAmount * 100) / 100).toFixed(2),
          daysCount: weekList.length,
          itemCount: itemCount,
          collapsed: isWkCollapsed,
          days: formatDaysList(weekList)
        }]
      }];
    }

    // 针对 month 或 all 模式：
    let filteredList = list;
    if (currentScope === 'month') {
      const targetDate = new Date(viewYear, viewMonth - 1, 1);
      filteredList = list.filter(g => isDateInThisMonth(g.date, targetDate));
      if (filteredList.length === 0) return [];
    }

    // 1. 先按月份归集
    const monthMap = {};
    const monthOrder = [];

    filteredList.forEach(day => {
      const mInfo = getMonthInfo(day.date);
      const mKey = mInfo.monthKey;
      if (!monthMap[mKey]) {
        monthMap[mKey] = {
          key: mKey,
          title: `${mInfo.year}年${mInfo.monthNum}月`,
          totalAmount: 0,
          daysCount: 0,
          itemCount: 0,
          weeksMap: {},
          weeksOrder: []
        };
        monthOrder.push(mKey);
      }

      const mObj = monthMap[mKey];
      mObj.totalAmount += (day.total || 0);
      mObj.daysCount += 1;
      if (day.items) mObj.itemCount += day.items.length;

      // 2. 在月份内按周归集 (如：9月第3周, 9月第2周, 9月第1周)
      const wInfo = getMonthWeekInfo(day.date);
      const wKey = wInfo.weekKey;
      if (!mObj.weeksMap[wKey]) {
        mObj.weeksMap[wKey] = {
          key: wKey,
          title: wInfo.weekTitle,
          rangeText: wInfo.rangeText,
          totalAmount: 0,
          daysCount: 0,
          itemCount: 0,
          days: []
        };
        mObj.weeksOrder.push(wKey);
      }

      const wObj = mObj.weeksMap[wKey];
      wObj.totalAmount += (day.total || 0);
      wObj.daysCount += 1;
      if (day.items) wObj.itemCount += day.items.length;
      wObj.days.push(day);
    });

    // 3. 构建结果树形结构
    return monthOrder.map((mKey, idx) => {
      const m = monthMap[mKey];
      
      const weeks = m.weeksOrder.map(wKey => {
        const w = m.weeksMap[wKey];
        const isWkManual = typeof this._collapsedState[wKey] === 'boolean';
        const isWkCollapsed = isWkManual ? this._collapsedState[wKey] : false;
        return {
          key: w.key,
          title: w.title,
          rangeText: w.rangeText,
          totalAmount: (Math.round(w.totalAmount * 100) / 100).toFixed(2),
          daysCount: w.daysCount,
          itemCount: w.itemCount,
          collapsed: isWkCollapsed,
          days: formatDaysList(w.days)
        };
      });

      // 月份折叠状态规则：all 模式下仅最新月默认展开，历史月默认折叠；month 模式下默认展开
      const isMonthManual = typeof this._collapsedState[mKey] === 'boolean';
      const defaultMonthCollapsed = (currentScope === 'all' && idx > 0);
      const isMonthCollapsed = isMonthManual ? this._collapsedState[mKey] : defaultMonthCollapsed;

      return {
        key: m.key,
        title: m.title,
        totalAmount: (Math.round(m.totalAmount * 100) / 100).toFixed(2),
        daysCount: m.daysCount,
        itemCount: m.itemCount,
        collapsed: isMonthCollapsed,
        weeks: weeks
      };
    });
  },

  checkAllCollapsed(list) {
    if (!list || list.length === 0) return false;
    return list.every(m => m.collapsed);
  },

  /**
   * 切换一级（月份）折叠/展开
   */
  toggleMonthCollapse(e) {
    const key = e.currentTarget.dataset.key;
    if (!this._collapsedState) this._collapsedState = {};
    const currentList = this.data.groupedTimeline || [];
    const target = currentList.find(m => m.key === key);
    const nextCollapsed = target ? !target.collapsed : false;
    this._collapsedState[key] = nextCollapsed;

    const updated = currentList.map(m => {
      if (m.key === key) {
        return Object.assign({}, m, { collapsed: nextCollapsed });
      }
      return m;
    });

    this.setData({
      groupedTimeline: updated,
      isAllTimelineCollapsed: this.checkAllCollapsed(updated)
    });
  },

  // 兼容别名
  toggleGroupCollapse(e) {
    this.toggleMonthCollapse(e);
  },

  /**
   * 切换二级（周）折叠/展开
   */
  toggleWeekCollapse(e) {
    const monthKey = e.currentTarget.dataset.monthKey;
    const weekKey = e.currentTarget.dataset.weekKey;
    if (!this._collapsedState) this._collapsedState = {};

    const currentList = this.data.groupedTimeline || [];
    const updated = currentList.map(m => {
      if (m.key === monthKey || (m.weeks && m.weeks.some(w => w.key === weekKey))) {
        const newWeeks = m.weeks.map(w => {
          if (w.key === weekKey) {
            const nextCollapsed = !w.collapsed;
            this._collapsedState[weekKey] = nextCollapsed;
            return Object.assign({}, w, { collapsed: nextCollapsed });
          }
          return w;
        });
        return Object.assign({}, m, { weeks: newWeeks });
      }
      return m;
    });

    this.setData({
      groupedTimeline: updated,
      isAllTimelineCollapsed: this.checkAllCollapsed(updated)
    });
  },

  /**
   * 一键全部展开 / 全部收起
   */
  toggleAllTimelineCollapse() {
    const currentList = this.data.groupedTimeline || [];
    const willCollapse = !this.data.isAllTimelineCollapsed;
    if (!this._collapsedState) this._collapsedState = {};

    const updated = currentList.map(m => {
      this._collapsedState[m.key] = willCollapse;
      const newWeeks = (m.weeks || []).map(w => {
        this._collapsedState[w.key] = willCollapse;
        return Object.assign({}, w, { collapsed: willCollapse });
      });
      return Object.assign({}, m, { collapsed: willCollapse, weeks: newWeeks });
    });

    this.setData({
      groupedTimeline: updated,
      isAllTimelineCollapsed: willCollapse
    });
  },

  switchScope(e) {
    const scope = e.currentTarget.dataset.scope || 'week';
    const list = this.data.bills || [];
    const { viewYear, viewMonth } = this.data;
    const groupedTimeline = this.buildGroupedTimeline(list, scope, viewYear, viewMonth);
    const isAllTimelineCollapsed = this.checkAllCollapsed(groupedTimeline);

    if (this._scopesData && this._scopesData[scope]) {
      const activeData = this._scopesData[scope];
      this.setData({
        currentScope: scope,
        scopeTitle: activeData.title,
        scopeTotalAmount: activeData.total,
        scopeSubtitle: activeData.sub,
        scopeDays: activeData.days,
        scopeAvg: activeData.avg,
        scopeHabits: activeData.habits,
        groupedTimeline,
        isAllTimelineCollapsed
      });
    } else {
      this.setData({ 
        currentScope: scope,
        groupedTimeline,
        isAllTimelineCollapsed
      });
    }
  },

  openAddModalDirect(e) {
    const mode = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.mode) || 'bill';
    this.setData({
      showAddModal: true,
      currentMode: mode
    });
  },

  closeAddModal() {
    this.setData({ showAddModal: false });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ currentMode: mode });
  },

  preventTouchMove() {},
  preventBubble() {},

  /* ------------------- 记账与自定义分类逻辑 ------------------- */
  loadCategories() {
    const customCats = getCustomCategories() || [];
    const formattedCustom = customCats.map(c => ({
      name: c.name,
      emoji: c.emoji || '🏷️',
      type: 'custom',
      isCustom: true
    }));
    const displayList = [
      ...PRESET_CATEGORIES.map(c => Object.assign({}, c, { isCustom: false })),
      ...formattedCustom,
      Object.assign({}, CUSTOM_CATEGORY_ITEM, { isCustom: false })
    ];
    this.setData({
      customCategories: customCats,
      presetCategories: displayList
    });
  },

  handleCategoryLongPress(e) {
    const cat = e.currentTarget.dataset.cat;
    if (!cat) return;
    if (!cat.isCustom) {
      wx.showToast({ title: '内置默认分类不可删除', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '删除自定义分类',
      content: `确定要删除分类【${cat.emoji} ${cat.name}】吗？（已记账单不受影响）`,
      confirmColor: '#ef4444',
      confirmText: '确定删除',
      success: (res) => {
        if (res.confirm) {
          deleteCustomCategory(cat.name);
          this.loadCategories();
          if (this.data.selectedCategory && this.data.selectedCategory.name === cat.name) {
            this.setData({ selectedCategory: PRESET_CATEGORIES[0] });
          }
          if (this.data.editCategory && this.data.editCategory.name === cat.name) {
            this.setData({ editCategory: PRESET_CATEGORIES[0] });
          }
          wx.showToast({ title: '已删除该分类', icon: 'none' });
        }
      }
    });
  },

  selectCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ 
      selectedCategory: cat,
      customCategoryName: '',
      customCategoryEmoji: '🏷️'
    });
  },

  selectCustomEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ customCategoryEmoji: emoji });
  },

  selectEditCustomEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ editCustomCategoryEmoji: emoji });
  },

  onAmountInput(e) {
    this.setData({ billAmount: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ billRemark: e.detail.value });
  },

  onCustomCategoryInput(e) {
    this.setData({ customCategoryName: e.detail.value });
  },

  handleSaveDirectBill() {
    const amount = parseFloat(this.data.billAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    const { selectedDateShort, selectedCategory, billRemark, customCategoryName, customCategoryEmoji } = this.data;
    
    // 如果选中的是【自定义】，取用户输入的分类名与选中的小表情，并保存至持久化自定义分类列表
    let finalName = selectedCategory.name;
    let finalEmoji = selectedCategory.emoji;
    let finalType = selectedCategory.type;

    if (selectedCategory.name === '自定义') {
      finalName = customCategoryName.trim() || '日常消费';
      finalEmoji = customCategoryEmoji || '🏷️';
      finalType = 'custom';
      addCustomCategory({ name: finalName, emoji: finalEmoji });
      this.loadCategories();
    }

    addDirectBill({
      date: selectedDateShort,
      name: finalName,
      amount: amount,
      emoji: finalEmoji,
      type: finalType,
      remark: billRemark.trim()
    });

    this.setData({
      showAddModal: false,
      billAmount: '',
      billRemark: '',
      customCategoryName: '',
      customCategoryEmoji: '🏷️',
      selectedCategory: PRESET_CATEGORIES[0]
    });

    this.refreshData();
    wx.showToast({
      title: `已记: ${finalEmoji} ¥${amount.toFixed(2)}`,
      icon: 'success'
    });
  },

  /* ------------------- 自定义打卡项逻辑 ------------------- */
  selectHabitEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ newHabitEmoji: emoji });
  },

  onNewHabitInput(e) {
    this.setData({ newHabitName: e.detail.value });
  },

  handleCreateCustomHabit() {
    const rawName = this.data.newHabitName.trim();
    if (!rawName) {
      wx.showToast({ title: '请输入打卡名称', icon: 'none' });
      return;
    }

    const emoji = this.data.newHabitEmoji || '⚡';
    // 组合成 "emoji 名称"，例如 "🧘 冥想"
    const fullName = `${emoji} ${rawName}`;
    const updated = addCustomHabit(fullName);
    this.setData({
      customHabits: updated,
      newHabitName: '',
      newHabitEmoji: '⚡'
    });
    wx.showToast({ title: `已创建【${fullName}】`, icon: 'success' });
  },

  handleDeleteCustomHabit(e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除打卡项',
      content: `确定要删除【${name}】打卡选项吗？（不会影响历史已记数据）`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const updated = deleteCustomHabit(name);
          this.setData({ customHabits: updated });
          wx.showToast({ title: '已移除', icon: 'none' });
        }
      }
    });
  },

  handleSaveDirectHabit(e) {
    const habitName = e.currentTarget.dataset.name;
    const { selectedDateShort } = this.data;

    addDirectHabit({
      date: selectedDateShort,
      habitName: habitName
    });

    this.setData({ showAddModal: false });
    this.refreshData();
    wx.showToast({ title: `⚡ 已打卡 【${habitName}】`, icon: 'success' });
  },

  /* ------------------- 读书与旅游随记 ------------------- */
  onBookTitleInput(e) {
    this.setData({ bookTitle: e.detail.value });
  },
  onBookProgressInput(e) {
    this.setData({ bookProgress: e.detail.value });
  },
  onBookQuoteInput(e) {
    this.setData({ bookQuote: e.detail.value });
  },
  handleSaveDirectBook() {
    const title = this.data.bookTitle.trim();
    if (!title) {
      wx.showToast({ title: '请输入书名', icon: 'none' });
      return;
    }
    const { selectedDateShort, bookProgress, bookQuote } = this.data;
    addDirectBook({
      date: selectedDateShort,
      title: title,
      progress: bookProgress.trim(),
      quote: bookQuote.trim()
    });

    this.setData({
      showAddModal: false,
      bookTitle: '',
      bookProgress: '',
      bookQuote: ''
    });
    this.refreshData();
    wx.showToast({ title: '📖 读书随记已保存', icon: 'success' });
  },

  onTravelLocationInput(e) {
    this.setData({ travelLocation: e.detail.value });
  },
  onTravelNotesInput(e) {
    this.setData({ travelNotes: e.detail.value });
  },
  handleSaveDirectTravel() {
    const loc = this.data.travelLocation.trim();
    if (!loc) {
      wx.showToast({ title: '请输入目的地', icon: 'none' });
      return;
    }
    const { selectedDateShort, travelTag, travelNotes } = this.data;
    addDirectTravel({
      date: selectedDateShort,
      location: loc,
      tag: travelTag,
      notes: travelNotes.trim()
    });

    this.setData({
      showAddModal: false,
      travelLocation: '',
      travelNotes: ''
    });
    this.refreshData();
    wx.showToast({ title: '✈️ 旅途漫记已保存', icon: 'success' });
  },

  /* ------------------- 账单条目修改与单笔删除逻辑 ------------------- */
  handleTapBillItem(e) {
    const { groupId, itemId } = e.currentTarget.dataset;
    const bills = getBills();
    const group = bills.find(g => g.id === groupId);
    if (!group || !group.items) return;

    const item = group.items.find(it => it.id === itemId);
    if (!item) return;

    // 解析名称与备注：例如 "午饭" 或 "午饭 (和同事聚餐)"
    let baseName = item.name;
    let remark = '';
    const remarkMatch = item.name.match(/^(.+?)\s*\((.+?)\)$/);
    if (remarkMatch) {
      baseName = remarkMatch[1].trim();
      remark = remarkMatch[2].trim();
    }

    // 匹配分类（优先从当前分类列表匹配，支持预设和已保存的自定义分类）
    const allCategories = this.data.presetCategories && this.data.presetCategories.length > 0 
      ? this.data.presetCategories 
      : PRESET_CATEGORIES;
    let matchedCat = allCategories.find(c => c.name === baseName);
    let customName = '';
    let customEmoji = '🏷️';
    if (!matchedCat) {
      matchedCat = allCategories.find(c => c.name === '自定义') || PRESET_CATEGORIES[PRESET_CATEGORIES.length - 1];
      customName = baseName;
      customEmoji = item.emoji || '🏷️';
    } else if (matchedCat.name === '自定义') {
      customName = baseName;
      customEmoji = item.emoji || '🏷️';
    } else {
      customEmoji = matchedCat.emoji;
    }

    const dObj = parseToDate(group.date);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${d}`;
    const display = `${dObj.getMonth() + 1}月${dObj.getDate()}日`;

    this.setData({
      showEditModal: true,
      editingGroupId: groupId,
      editingItemId: itemId,
      editAmount: String(item.amount),
      editCategory: matchedCat,
      editCustomCategoryName: customName,
      editCustomCategoryEmoji: customEmoji,
      editRemark: remark,
      editDateString: ymd,
      editDateShort: group.date,
      editDateDisplay: display
    });
  },

  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  onEditAmountInput(e) {
    this.setData({ editAmount: e.detail.value });
  },

  selectEditCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ editCategory: cat });
  },

  onEditCustomCategoryInput(e) {
    this.setData({ editCustomCategoryName: e.detail.value });
  },

  onEditRemarkInput(e) {
    this.setData({ editRemark: e.detail.value });
  },

  onEditDateChange(e) {
    const ymd = e.detail.value;
    const parts = ymd.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    this.setData({
      editDateString: ymd,
      editDateShort: `${m}.${d}`,
      editDateDisplay: `${m}月${d}日`
    });
  },

  handleSaveEditBill() {
    const { 
      editingGroupId, 
      editingItemId, 
      editAmount, 
      editCategory, 
      editCustomCategoryName, 
      editCustomCategoryEmoji,
      editRemark, 
      editDateShort 
    } = this.data;

    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    let finalName = editCategory.name;
    let finalEmoji = editCategory.emoji;
    let finalType = editCategory.type;

    if (editCategory.name === '自定义') {
      finalName = (editCustomCategoryName || '').trim() || '日常消费';
      finalEmoji = editCustomCategoryEmoji || '🏷️';
      finalType = 'custom';
      if (finalName && finalName !== '自定义' && finalName !== '日常消费') {
        addCustomCategory({ name: finalName, emoji: finalEmoji });
        this.loadCategories();
      }
    }

    const ok = updateBillItem({
      groupId: editingGroupId,
      itemId: editingItemId,
      name: finalName,
      amount: numAmount,
      emoji: finalEmoji,
      type: finalType,
      newDate: editDateShort,
      remark: (editRemark || '').trim()
    });

    if (ok) {
      this.setData({ showEditModal: false });
      this.refreshData();
      wx.showToast({ title: '✓ 已更新修改', icon: 'success' });
    } else {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  handleDeleteSingleItem() {
    const { editingGroupId, editingItemId, editAmount, editCategory, editCustomCategoryName } = this.data;
    const catName = editCategory.name === '自定义' ? (editCustomCategoryName || '自定义') : editCategory.name;

    wx.showModal({
      title: '删除这笔账单',
      content: `确定要删除这笔「${catName} ¥${editAmount}」吗？`,
      confirmColor: '#ef4444',
      confirmText: '确定删除',
      success: (res) => {
        if (res.confirm) {
          deleteBillItem(editingGroupId, editingItemId);
          this.setData({ showEditModal: false });
          this.refreshData();
          wx.showToast({ title: '已删除该笔账单', icon: 'none' });
        }
      }
    });
  },

  handleDayMoreActions(e) {
    const { id, date } = e.currentTarget.dataset;
    wx.showActionSheet({
      itemList: ['➕ 为该日补记一笔', '🗑️ 删除该日整天手账'],
      itemColor: '#1e293b',
      success: (res) => {
        if (res.tapIndex === 0) {
          const dObj = parseToDate(date);
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          this.setData({
            showAddModal: true,
            currentMode: 'bill',
            selectedDateString: `${y}-${m}-${d}`,
            selectedDateShort: date,
            selectedDateDisplay: `${dObj.getMonth() + 1}月${dObj.getDate()}日`
          });
        } else if (res.tapIndex === 1) {
          this.handleDeleteGroup({ currentTarget: { dataset: { id, date } } });
        }
      }
    });
  },

  _getDateParts(dateStr) {
    const dObj = parseToDate(dateStr);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return {
      ymd: `${y}-${m}-${d}`,
      short: dateStr,
      display: `${dObj.getMonth() + 1}月${dObj.getDate()}日`
    };
  },

  handleTapLifeBlock(e) {
    const { groupId, type } = e.currentTarget.dataset;
    const typeLabel = type === 'book' ? '读书随记' : '旅途漫记';
    wx.showActionSheet({
      itemList: [`✏️ 修改${typeLabel}内容与日期`, `🗑️ 删除此条${typeLabel}`],
      itemColor: '#1e293b',
      success: (res) => {
        if (res.tapIndex === 0) {
          if (type === 'book') {
            this.openEditBookModal(groupId);
          } else {
            this.openEditTravelModal(groupId);
          }
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: `删除${typeLabel}`,
            content: `确定要删除该条${typeLabel}吗？`,
            confirmColor: '#ef4444',
            confirmText: '确定删除',
            success: (r) => {
              if (r.confirm) {
                deleteLifeBlock(groupId, type);
                this.refreshData();
                wx.showToast({ title: '已删除', icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  /* ------------------- 读书随记修改弹窗 ------------------- */
  openEditBookModal(groupId) {
    const group = this.data.bills.find(g => g.id === groupId);
    if (!group || !group.book) return;
    const dateInfo = this._getDateParts(group.date);
    let title = group.book.title || '';
    if (title.startsWith('《') && title.endsWith('》')) {
      title = title.slice(1, -1);
    }
    this.setData({
      showEditBookModal: true,
      editBookGroupId: groupId,
      editBookTitle: title,
      editBookProgress: group.book.progress || '',
      editBookQuote: group.book.quote || '',
      editBookDateString: dateInfo.ymd,
      editBookDateShort: dateInfo.short,
      editBookDateDisplay: dateInfo.display
    });
  },

  closeEditBookModal() {
    this.setData({ showEditBookModal: false });
  },

  onEditBookTitleInput(e) {
    this.setData({ editBookTitle: e.detail.value });
  },

  onEditBookProgressInput(e) {
    this.setData({ editBookProgress: e.detail.value });
  },

  onEditBookQuoteInput(e) {
    this.setData({ editBookQuote: e.detail.value });
  },

  onEditBookDateChange(e) {
    const ymd = e.detail.value;
    const parts = ymd.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    this.setData({
      editBookDateString: ymd,
      editBookDateShort: `${m}.${d}`,
      editBookDateDisplay: `${m}月${d}日`
    });
  },

  handleSaveEditBook() {
    const { editBookGroupId, editBookTitle, editBookProgress, editBookQuote, editBookDateShort } = this.data;
    const title = (editBookTitle || '').trim();
    if (!title) {
      wx.showToast({ title: '请输入书名', icon: 'none' });
      return;
    }
    const ok = updateLifeBlock({
      groupId: editBookGroupId,
      blockType: 'book',
      newDate: editBookDateShort,
      data: {
        title,
        progress: (editBookProgress || '').trim() || '进行中',
        quote: (editBookQuote || '').trim()
      }
    });
    if (ok) {
      this.setData({ showEditBookModal: false });
      this.refreshData();
      wx.showToast({ title: '✓ 已更新读书随记', icon: 'success' });
    } else {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  handleDeleteBookDirect() {
    const { editBookGroupId } = this.data;
    wx.showModal({
      title: '删除读书随记',
      content: '确定要删除该条读书随记吗？',
      confirmColor: '#ef4444',
      confirmText: '确定删除',
      success: (res) => {
        if (res.confirm) {
          deleteLifeBlock(editBookGroupId, 'book');
          this.setData({ showEditBookModal: false });
          this.refreshData();
          wx.showToast({ title: '已删除读书随记', icon: 'none' });
        }
      }
    });
  },

  /* ------------------- 旅途漫记修改弹窗 ------------------- */
  openEditTravelModal(groupId) {
    const group = this.data.bills.find(g => g.id === groupId);
    if (!group || !group.travel) return;
    const dateInfo = this._getDateParts(group.date);
    this.setData({
      showEditTravelModal: true,
      editTravelGroupId: groupId,
      editTravelLocation: group.travel.location || '',
      editTravelTag: group.travel.tag || '周末漫游',
      editTravelNotes: group.travel.notes || '',
      editTravelDateString: dateInfo.ymd,
      editTravelDateShort: dateInfo.short,
      editTravelDateDisplay: dateInfo.display
    });
  },

  closeEditTravelModal() {
    this.setData({ showEditTravelModal: false });
  },

  onEditTravelLocationInput(e) {
    this.setData({ editTravelLocation: e.detail.value });
  },

  onEditTravelTagInput(e) {
    this.setData({ editTravelTag: e.detail.value });
  },

  onEditTravelNotesInput(e) {
    this.setData({ editTravelNotes: e.detail.value });
  },

  onEditTravelDateChange(e) {
    const ymd = e.detail.value;
    const parts = ymd.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    this.setData({
      editTravelDateString: ymd,
      editTravelDateShort: `${m}.${d}`,
      editTravelDateDisplay: `${m}月${d}日`
    });
  },

  handleSaveEditTravel() {
    const { editTravelGroupId, editTravelLocation, editTravelTag, editTravelNotes, editTravelDateShort } = this.data;
    const location = (editTravelLocation || '').trim();
    if (!location) {
      wx.showToast({ title: '请输入地点或景点', icon: 'none' });
      return;
    }
    const ok = updateLifeBlock({
      groupId: editTravelGroupId,
      blockType: 'travel',
      newDate: editTravelDateShort,
      data: {
        location,
        tag: (editTravelTag || '').trim() || '周末漫游',
        notes: (editTravelNotes || '').trim()
      }
    });
    if (ok) {
      this.setData({ showEditTravelModal: false });
      this.refreshData();
      wx.showToast({ title: '✓ 已更新旅途漫记', icon: 'success' });
    } else {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  handleDeleteTravelDirect() {
    const { editTravelGroupId } = this.data;
    wx.showModal({
      title: '删除旅途漫记',
      content: '确定要删除该条旅途漫记吗？',
      confirmColor: '#ef4444',
      confirmText: '确定删除',
      success: (res) => {
        if (res.confirm) {
          deleteLifeBlock(editTravelGroupId, 'travel');
          this.setData({ showEditTravelModal: false });
          this.refreshData();
          wx.showToast({ title: '已删除旅途漫记', icon: 'none' });
        }
      }
    });
  },

  /* ------------------- 打卡记录修改弹窗 ------------------- */
  handleTapDayHabit(e) {
    const { groupId, tag } = e.currentTarget.dataset;
    wx.showActionSheet({
      itemList: ['✏️ 修改该日打卡项与日期', `🗑️ 取消打卡「${tag}」`],
      itemColor: '#1e293b',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.openEditHabitModal(groupId);
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '取消打卡',
            content: `确定取消该日的「${tag}」打卡吗？`,
            confirmColor: '#ef4444',
            confirmText: '取消打卡',
            success: (r) => {
              if (r.confirm) {
                deleteDayHabit(groupId, tag);
                this.refreshData();
                wx.showToast({ title: '已取消打卡', icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  handleOpenEditHabits(e) {
    const { groupId } = e.currentTarget.dataset;
    this.openEditHabitModal(groupId);
  },

  _buildHabitMap(tags) {
    const map = {};
    (tags || []).forEach(t => { map[t] = true; });
    return map;
  },

  openEditHabitModal(groupId) {
    const group = this.data.bills.find(g => g.id === groupId);
    if (!group) return;
    const dateInfo = this._getDateParts(group.date);
    const currentTags = group.tags || [];
    const available = Array.from(new Set([...(this.data.customHabits || []), ...currentTags]));
    this.setData({
      showEditHabitModal: true,
      editHabitGroupId: groupId,
      editHabitSelectedTags: [...currentTags],
      editHabitSelectedMap: this._buildHabitMap(currentTags),
      editHabitAvailableTags: available,
      editHabitDateString: dateInfo.ymd,
      editHabitDateShort: dateInfo.short,
      editHabitDateDisplay: dateInfo.display
    });
  },

  closeEditHabitModal() {
    this.setData({ showEditHabitModal: false });
  },

  toggleEditHabitTag(e) {
    const tag = e.currentTarget.dataset.tag;
    let selected = [...this.data.editHabitSelectedTags];
    const idx = selected.indexOf(tag);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(tag);
    }
    this.setData({ 
      editHabitSelectedTags: selected,
      editHabitSelectedMap: this._buildHabitMap(selected)
    });
  },

  onEditHabitDateChange(e) {
    const ymd = e.detail.value;
    const parts = ymd.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    this.setData({
      editHabitDateString: ymd,
      editHabitDateShort: `${m}.${d}`,
      editHabitDateDisplay: `${m}月${d}日`
    });
  },

  handleSaveEditHabits() {
    const { editHabitGroupId, editHabitSelectedTags, editHabitDateShort } = this.data;
    const ok = updateDayHabits({
      groupId: editHabitGroupId,
      newDate: editHabitDateShort,
      tags: editHabitSelectedTags
    });
    if (ok) {
      this.setData({ showEditHabitModal: false });
      this.refreshData();
      wx.showToast({ title: '✓ 已更新打卡记录', icon: 'success' });
    } else {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  handleClearDayHabitsDirect() {
    const { editHabitGroupId, editHabitDateShort } = this.data;
    wx.showModal({
      title: '清空该日打卡',
      content: '确定要清空该天的所有打卡记录吗？',
      confirmColor: '#ef4444',
      confirmText: '确定清空',
      success: (res) => {
        if (res.confirm) {
          updateDayHabits({
            groupId: editHabitGroupId,
            newDate: editHabitDateShort,
            tags: []
          });
          this.setData({ showEditHabitModal: false });
          this.refreshData();
          wx.showToast({ title: '已清空打卡', icon: 'none' });
        }
      }
    });
  },

  preventBubble() {},

  handleDeleteGroup(e) {
    const { id, date } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除确认',
      content: `确定要删除 ${date} 的全部记录吗？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          deleteBillGroup(id);
          this.refreshData();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  handleExport() {
    const fullText = exportBillsAsText(this.data.bills);
    wx.setClipboardData({
      data: fullText,
      success: () => {
        wx.showModal({
          title: '导出成功',
          content: '已将包含消费清单、打卡记录的全文复制到剪贴板，可直接粘贴备份！',
          showCancel: false
        });
      }
    });
  },

  // 批量文本导入相关
  openImportModal() {
    this.setData({
      showAddModal: true,
      currentMode: 'import',
      importRawText: ''
    });
  },

  closeImportModal() {
    this.setData({
      showAddModal: false,
      showImportModal: false
    });
  },

  onImportInput(e) {
    this.setData({
      importRawText: e.detail.value
    });
  },

  pasteFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({
            importRawText: res.data
          });
          wx.showToast({ title: '已粘贴剪贴板', icon: 'success' });
        } else {
          wx.showToast({ title: '剪贴板为空', icon: 'none' });
        }
      }
    });
  },

  fillSixMonthsTestData() {
    this.setData({
      importRawText: SIX_MONTHS_RAW_TEXT
    });
    wx.showToast({ title: '已载入6个月手账', icon: 'success' });
  },

  fillSampleImport() {
    const sample = `9.14\n美团小象超市:39.8\n早饭 16.7\n晚饭 13.49\n合计 69.99\n\n9.15\n早饭 14.39\n晚饭 10.49\n夜宵 10.4\n合计 35.28`;
    this.setData({
      importRawText: sample
    });
  },

  clearImportText() {
    this.setData({
      importRawText: ''
    });
  },

  handleConfirmImport() {
    const text = (this.data.importRawText || '').trim();
    if (!text) {
      wx.showToast({ title: '请粘贴或输入账单文本', icon: 'none' });
      return;
    }

    const groups = parseBillText(text);
    if (!groups || groups.length === 0) {
      wx.showModal({
        title: '未能识别有效账单',
        content: '未能识别出日期和消费条目，请确保每行包含“品类 金额”（如：早饭 16.7 或 美团超市:39.8）。',
        showCancel: false
      });
      return;
    }

    addBillGroups(groups);
    this.refreshData();
    this.setData({
      showAddModal: false,
      showImportModal: false,
      importRawText: ''
    });
    wx.showToast({
      title: `成功导入 ${groups.length} 天记录`,
      icon: 'success'
    });
  },

  /* ------------------- 微信云开发手动同步操作 ------------------- */
  async handleManualCloudUpload() {
    wx.showLoading({ title: '正在同步到云端...' });
    try {
      await manualUpload();
      wx.hideLoading();
      wx.showToast({ title: '已成功同步至云端', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showModal({
        title: '同步失败',
        content: e.message || '请检查微信开发者工具是否已登录并开通云开发',
        showCancel: false
      });
    }
  },

  handleManualCloudDownload() {
    wx.showModal({
      title: '从云端拉取覆盖',
      content: '确定要从云端拉取最新数据覆盖本地吗？（未同步至云端的本地修改将被替换）',
      confirmColor: '#07C160',
      confirmText: '确定拉取',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在拉取云端数据...' });
          try {
            await manualDownload();
            this.refreshData();
            this.loadCategories();
            wx.hideLoading();
            wx.showToast({ title: '已恢复云端数据', icon: 'success' });
          } catch (e) {
            wx.hideLoading();
            wx.showModal({
              title: '拉取失败',
              content: e.message || '云端暂无数据或网络连接异常',
              showCancel: false
            });
          }
        }
      }
    });
  },

  /* ------------------- 数据清理与重置操作 ------------------- */
  handleCleanTestData() {
    wx.showModal({
      title: '剔除测试数据',
      content: '确定要剔除导入的6个月测试数据吗？（你自己的真实账单和打卡会被安全保留）',
      confirmColor: '#c2410c',
      confirmText: '确定剔除',
      success: (res) => {
        if (res.confirm) {
          const result = cleanTestData();
          if (result.success) {
            this.refreshData();
            wx.showModal({
              title: '清理完成',
              content: `已成功剔除 ${result.removedCount} 笔测试记录，保留了 ${result.remainingDays} 天真实手账。`,
              showCancel: false
            });
          } else {
            wx.showToast({ title: '清理失败: ' + (result.error || ''), icon: 'none' });
          }
        }
      }
    });
  },

  handleClearAllData() {
    wx.showModal({
      title: '⚠️ 彻底清空整个账本',
      content: '确定要清空全部账本数据吗？所有消费流水、打卡、读书与旅行随记将被彻底清除，恢复为空白手账。',
      confirmColor: '#ef4444',
      confirmText: '彻底清空',
      success: (res) => {
        if (res.confirm) {
          clearAllBills();
          this.refreshData();
          wx.showToast({ title: '已恢复空白账本', icon: 'success' });
        }
      }
    });
  }
});
