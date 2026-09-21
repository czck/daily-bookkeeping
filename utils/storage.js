/**
 * 本地存储操作类 (基于 wx.setStorageSync / wx.getStorageSync)
 * 支持记账、生活随记（看书、旅游）、完全自定义生活打卡项管理
 */

const STORAGE_KEY = 'SHUIYIN_BILLS_DATA_V3';
const HABITS_KEY = 'MY_CUSTOM_HABITS_LIST_V1';
const CUSTOM_CATEGORIES_KEY = 'MY_CUSTOM_CATEGORIES_LIST_V1';

// 默认预置的打卡项（用户可随意新增或删除）
const DEFAULT_HABITS = [
  '🏃 健身',
  '🌙 早睡',
  '💧 8杯水',
  '😊 好心情'
];

// 示例账单模板（仅用于导入参考，不预设进用户真实账本）
const DEFAULT_BILLS = [
  {
    id: 'group_9_15',
    date: '9.15',
    dateDisplay: '9月15日',
    weekday: '周二',
    items: [
      { id: 'item_1', name: '早饭', amount: 14.39, emoji: '🍳', tag: '早', type: 'breakfast' },
      { id: 'item_2', name: '晚饭', amount: 10.49, emoji: '🍲', tag: '晚', type: 'dinner' },
      { id: 'item_3', name: '夜宵', amount: 10.40, emoji: '🍢', tag: '宵', type: 'snack' }
    ],
    total: 35.28,
    book: {
      title: '《置身事内》',
      progress: '读完第2章',
      quote: '讲地方政府与城市投资，对经济运行逻辑有了全新理解。'
    },
    tags: ['🏃 健身', '🌙 早睡', '💧 8杯水']
  },
  {
    id: 'group_9_14',
    date: '9.14',
    dateDisplay: '9月14日',
    weekday: '周一',
    items: [
      { id: 'item_4', name: '美团小象超市', amount: 39.80, emoji: '🛒', tag: '超', type: 'market' },
      { id: 'item_5', name: '早饭', amount: 16.70, emoji: '🍳', tag: '早', type: 'breakfast' },
      { id: 'item_6', name: '晚饭', amount: 13.49, emoji: '🍲', tag: '晚', type: 'dinner' }
    ],
    total: 69.99,
    travel: {
      location: '西湖断桥漫步',
      tag: '周末漫游',
      notes: '傍晚微风徐徐，荷花刚谢，沿湖散步喝了杯茶。'
    },
    tags: ['🏃 健身']
  }
];

const { parseToDate } = require('./date_helper.js');

function sortBillsDescending(bills) {
  if (!Array.isArray(bills)) return [];
  return bills.slice().sort((a, b) => {
    const timeA = parseToDate(a.date).getTime();
    const timeB = parseToDate(b.date).getTime();
    return timeB - timeA;
  });
}

function getBills() {
  try {
    const data = wx.getStorageSync(STORAGE_KEY);
    if (data && Array.isArray(data)) {
      return sortBillsDescending(data);
    }
    // 首次进入小程序无任何默认假数据，返回空数组
    return [];
  } catch (e) {
    console.error('读取存储失败', e);
    return [];
  }
}

function triggerCloudSync() {
  try {
    const { notifyDataChanged } = require('./cloud_sync.js');
    if (typeof notifyDataChanged === 'function') {
      notifyDataChanged();
    }
  } catch (e) {
    // 降级忽略
  }
}

function clearAllBills() {
  try {
    wx.setStorageSync(STORAGE_KEY, []);
    triggerCloudSync();
    return true;
  } catch (e) {
    return false;
  }
}

function setBills(bills) {
  try {
    const sorted = sortBillsDescending(bills);
    wx.setStorageSync(STORAGE_KEY, sorted);
    triggerCloudSync();
    return true;
  } catch (e) {
    console.error('写入存储失败', e);
    return false;
  }
}

/**
 * 获取用户自定义的打卡项列表
 */
function getCustomHabits() {
  try {
    const data = wx.getStorageSync(HABITS_KEY);
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
    wx.setStorageSync(HABITS_KEY, DEFAULT_HABITS);
    return DEFAULT_HABITS;
  } catch (e) {
    return DEFAULT_HABITS;
  }
}

/**
 * 新增一个自定义打卡项
 */
function addCustomHabit(name) {
  if (!name || !name.trim()) return false;
  const list = getCustomHabits();
  const cleanName = name.trim();
  if (!list.includes(cleanName)) {
    list.push(cleanName);
    wx.setStorageSync(HABITS_KEY, list);
    triggerCloudSync();
  }
  return list;
}

/**
 * 删除一个自定义打卡项
 */
function deleteCustomHabit(name) {
  const list = getCustomHabits().filter(h => h !== name);
  wx.setStorageSync(HABITS_KEY, list);
  triggerCloudSync();
  return list;
}

/**
 * 获取用户自定义的记账分类列表
 * 格式: [{ name: '数码', emoji: '💻', type: 'custom' }]
 */
function getCustomCategories() {
  try {
    const data = wx.getStorageSync(CUSTOM_CATEGORIES_KEY);
    if (data && Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存/添加一个自定义记账分类
 */
function addCustomCategory({ name, emoji }) {
  if (!name || !name.trim()) return getCustomCategories();
  const cleanName = name.trim();
  const cleanEmoji = emoji || '🏷️';
  let list = getCustomCategories();
  const existingIndex = list.findIndex(c => c.name === cleanName);
  if (existingIndex >= 0) {
    // 若已存在同名分类，更新其表情
    list[existingIndex].emoji = cleanEmoji;
  } else {
    list.push({
      name: cleanName,
      emoji: cleanEmoji,
      type: 'custom'
    });
  }
  try {
    wx.setStorageSync(CUSTOM_CATEGORIES_KEY, list);
    triggerCloudSync();
  } catch (e) {
    console.error('保存自定义分类失败', e);
  }
  return list;
}

/**
 * 删除一个自定义记账分类
 */
function deleteCustomCategory(name) {
  let list = getCustomCategories().filter(c => c.name !== name);
  try {
    wx.setStorageSync(CUSTOM_CATEGORIES_KEY, list);
    triggerCloudSync();
  } catch (e) {
    console.error('删除自定义分类失败', e);
  }
  return list;
}

function findOrCreateGroup(bills, targetDate) {
  let group = bills.find(g => g.date === targetDate);
  if (!group) {
    const match = targetDate.match(/(\d{1,2})[\.\-\/月](\d{1,2})/);
    const display = match ? `${match[1]}月${match[2]}日` : targetDate;
    group = {
      id: 'group_' + targetDate.replace(/[\.\-\/月日]/g, '_') + '_' + Date.now(),
      date: targetDate,
      dateDisplay: display,
      items: [],
      total: 0,
      tags: []
    };
    bills.unshift(group);
  }
  return group;
}

function addDirectBill({ date, name, amount, emoji, type, remark }) {
  const bills = getBills();
  const group = findOrCreateGroup(bills, date);

  const fullName = remark ? `${name} (${remark})` : name;
  group.items.push({
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: fullName,
    amount: Math.round(amount * 100) / 100,
    emoji: emoji || '🍳',
    tag: name.slice(0, 1) || '账',
    type: type || 'other'
  });

  const sum = group.items.reduce((acc, it) => acc + (it.amount || 0), 0);
  group.total = Math.round(sum * 100) / 100;

  setBills(bills);
  return bills;
}

function addDirectBook({ date, title, progress, quote }) {
  const bills = getBills();
  const group = findOrCreateGroup(bills, date);

  group.book = {
    title: title.startsWith('《') ? title : `《${title}》`,
    progress: progress || '进行中',
    quote: quote || ''
  };

  setBills(bills);
  return bills;
}

function addDirectTravel({ date, location, tag, notes }) {
  const bills = getBills();
  const group = findOrCreateGroup(bills, date);

  group.travel = {
    location: location,
    tag: tag || '漫游',
    notes: notes || ''
  };

  setBills(bills);
  return bills;
}

/**
 * 记录某天的自定义打卡项
 */
function addDirectHabit({ date, habitName }) {
  const bills = getBills();
  const group = findOrCreateGroup(bills, date);

  if (!group.tags) group.tags = [];
  if (!group.tags.includes(habitName)) {
    group.tags.push(habitName);
  }

  setBills(bills);
  return bills;
}

function addBillGroups(newGroups) {
  if (!newGroups || newGroups.length === 0) return false;
  const current = getBills();

  newGroups.forEach(newG => {
    // 自动收集新打卡项进自定义打卡库
    if (newG.tags && Array.isArray(newG.tags)) {
      newG.tags.forEach(t => {
        if (t && typeof t === 'string' && t.trim()) {
          addCustomHabit(t.trim());
        }
      });
    }

    const existingIndex = current.findIndex(g => g.date === newG.date);
    if (existingIndex >= 0) {
      const target = current[existingIndex];
      target.items = (target.items || []).concat(newG.items || []);
      const sum = target.items.reduce((acc, it) => acc + (it.amount || 0), 0);
      target.total = Math.round(sum * 100) / 100;
      if (newG.book) target.book = newG.book;
      if (newG.travel) target.travel = newG.travel;
      if (newG.note) target.note = (target.note ? target.note + ' ' : '') + newG.note;
      if (newG.tags && newG.tags.length > 0) {
        const combined = (target.tags || []).concat(newG.tags || []);
        target.tags = Array.from(new Set(combined));
      }
    } else {
      current.unshift(newG);
    }
  });

  setBills(current);
  return true;
}

function deleteBillGroup(id) {
  const current = getBills().filter(g => g.id !== id);
  setBills(current);
  return current;
}

/**
 * 修改单笔账单条目
 */
function updateBillItem({ groupId, itemId, name, amount, emoji, type, newDate, remark }) {
  const bills = getBills();
  const group = bills.find(g => g.id === groupId);
  if (!group || !group.items) return false;

  const itemIndex = group.items.findIndex(it => it.id === itemId);
  if (itemIndex < 0) return false;

  const targetItem = group.items[itemIndex];
  const finalFullName = remark ? `${name} (${remark})` : name;
  const numAmount = Math.round(parseFloat(amount) * 100) / 100;

  targetItem.name = finalFullName;
  targetItem.amount = numAmount;
  if (emoji) targetItem.emoji = emoji;
  if (type) targetItem.type = type;

  // 检查是否修改了日期
  if (newDate && newDate !== group.date) {
    // 从原 group 中移除
    group.items.splice(itemIndex, 1);
    const oldSum = group.items.reduce((acc, it) => acc + (it.amount || 0), 0);
    group.total = Math.round(oldSum * 100) / 100;

    // 移入新日期的 group
    const targetGroup = findOrCreateGroup(bills, newDate);
    targetGroup.items.push(targetItem);
    const newSum = targetGroup.items.reduce((acc, it) => acc + (it.amount || 0), 0);
    targetGroup.total = Math.round(newSum * 100) / 100;

    // 如果原 group 没有任何内容，且没有书/旅行/打卡，清理原 group
    if (group.items.length === 0 && !group.book && !group.travel && (!group.tags || group.tags.length === 0)) {
      const gIdx = bills.findIndex(g => g.id === groupId);
      if (gIdx >= 0) bills.splice(gIdx, 1);
    }
  } else {
    // 重新计算当日合计
    const sum = group.items.reduce((acc, it) => acc + (it.amount || 0), 0);
    group.total = Math.round(sum * 100) / 100;
  }

  setBills(bills);
  return true;
}

/**
 * 删除单笔账单条目
 */
function deleteBillItem(groupId, itemId) {
  const bills = getBills();
  const group = bills.find(g => g.id === groupId);
  if (!group || !group.items) return false;

  const idx = group.items.findIndex(it => it.id === itemId);
  if (idx < 0) return false;

  group.items.splice(idx, 1);
  const sum = group.items.reduce((acc, it) => acc + (it.amount || 0), 0);
  group.total = Math.round(sum * 100) / 100;

  // 如果 items 为空且无其他内容，清理该 group
  if (group.items.length === 0 && !group.book && !group.travel && (!group.tags || group.tags.length === 0)) {
    const gIdx = bills.findIndex(g => g.id === groupId);
    if (gIdx >= 0) bills.splice(gIdx, 1);
  }

  setBills(bills);
  return true;
}

/**
 * 删除生活块（读书或旅行）
 */
function deleteLifeBlock(groupId, blockType) {
  const bills = getBills();
  const group = bills.find(g => g.id === groupId);
  if (!group) return false;

  if (blockType === 'book') {
    delete group.book;
  } else if (blockType === 'travel') {
    delete group.travel;
  }

  if ((!group.items || group.items.length === 0) && !group.book && !group.travel && (!group.tags || group.tags.length === 0)) {
    const gIdx = bills.findIndex(g => g.id === groupId);
    if (gIdx >= 0) bills.splice(gIdx, 1);
  }

  setBills(bills);
  return true;
}

/**
 * 取消某天的某项打卡
 */
function deleteDayHabit(groupId, habitTag) {
  const bills = getBills();
  const group = bills.find(g => g.id === groupId);
  if (!group || !group.tags) return false;

  group.tags = group.tags.filter(t => t !== habitTag);

  if ((!group.items || group.items.length === 0) && !group.book && !group.travel && group.tags.length === 0) {
    const gIdx = bills.findIndex(g => g.id === groupId);
    if (gIdx >= 0) bills.splice(gIdx, 1);
  }

  setBills(bills);
  return true;
}

function exportBillsAsText(bills) {
  const list = bills || getBills();
  const textParts = ['日常消费与生活手帐清单\n'];

  list.forEach(group => {
    textParts.push(group.date);
    group.items.forEach(it => {
      textParts.push(`${it.name} ${it.amount}`);
    });
    textParts.push(`合计 ${group.total}`);
    if (group.book) {
      textParts.push(`看书 ${group.book.title} ${group.book.progress}: ${group.book.quote}`);
    }
    if (group.travel) {
      textParts.push(`旅行 ${group.travel.location} (${group.travel.tag}): ${group.travel.notes}`);
    }
    if (group.tags && group.tags.length > 0) {
      textParts.push(`打卡: ${group.tags.join(' ')}`);
    }
    textParts.push('');
  });

  return textParts.join('\n');
}

/**
 * 精准剔除导入的6个月测试数据，完整保留用户的真实记账、打卡和随记
 */
function cleanTestData() {
  try {
    const { parseBillText } = require('./parser.js');
    const { SIX_MONTHS_RAW_TEXT } = require('./sample_six_months.js');
    const testGroups = parseBillText(SIX_MONTHS_RAW_TEXT);

    const testItemsSet = new Set();
    testGroups.forEach(g => {
      g.items.forEach(it => {
        testItemsSet.add(`${g.date}_${it.name}_${it.amount}`);
      });
    });

    const current = getBills();
    let removedCount = 0;
    const cleaned = [];

    current.forEach(group => {
      const remainingItems = (group.items || []).filter(it => {
        const key = `${group.date}_${it.name}_${it.amount}`;
        if (testItemsSet.has(key)) {
          removedCount++;
          return false;
        }
        return true;
      });

      const testG = testGroups.find(tg => tg.date === group.date);
      let remainingBook = group.book;
      if (testG && testG.book && remainingBook && remainingBook.title === testG.book.title) {
        remainingBook = undefined;
      }

      let remainingTravel = group.travel;
      if (testG && testG.travel && remainingTravel && remainingTravel.location === testG.travel.location) {
        remainingTravel = undefined;
      }

      // 如果过滤后该日还有用户自己的真实消费、读书或漫游，则保留该日
      if (remainingItems.length > 0 || remainingBook || remainingTravel) {
        cleaned.push(Object.assign({}, group, {
          items: remainingItems,
          total: Math.round(remainingItems.reduce((acc, it) => acc + (it.amount || 0), 0) * 100) / 100,
          book: remainingBook,
          travel: remainingTravel
        }));
      }
    });

    setBills(cleaned);
    return { success: true, removedCount, remainingDays: cleaned.length };
  } catch (e) {
    console.error('清理测试数据失败', e);
    return { success: false, error: e.message };
  }
}

module.exports = {
  getBills,
  setBills,
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
  deleteDayHabit,
  exportBillsAsText,
  clearAllBills,
  cleanTestData,
  DEFAULT_BILLS
};
