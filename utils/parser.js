/**
 * 文本记账解析工具类
 * 支持直接带 Emoji 小表情的品类映射
 */

const CATEGORY_MAP = [
  { keywords: ['早', '早餐', '早点', '包子', '豆浆', '油条'], name: '早饭', emoji: '🍳', type: 'breakfast' },
  { keywords: ['午', '午餐', '中饭', '中餐', '快餐'], name: '午饭', emoji: '🍱', type: 'lunch' },
  { keywords: ['晚', '晚餐', '大排档'], name: '晚饭', emoji: '🍲', type: 'dinner' },
  { keywords: ['夜宵', '宵夜', '烧烤', '炸鸡', '串串', '夜'], name: '夜宵', emoji: '🍢', type: 'snack' },
  { keywords: ['房租', '租房', '房费', '月租'], name: '房租', emoji: '🏠', type: 'rent' },
  { keywords: ['水电', '电费', '水费', '燃气', '天然气', '物业', '网费', '宽带'], name: '水电费', emoji: '💡', type: 'utilities' },
  { keywords: ['超市', '象', '买菜', '生鲜'], name: '美团小象超市', emoji: '🛒', type: 'market' },
  { keywords: ['淘宝', '拼多多', '京东', '天猫', '唯品会', '网购', '购物', '买衣服', '平台'], name: '购物平台', emoji: '🛍️', type: 'shopping' },
  { keywords: ['水果', '零食', '零嘴', '瓜果', '点心'], name: '水果零食', emoji: '🍎', type: 'fruit' },
  { keywords: ['咖啡', '奶茶', '饮品', '饮料', '茶', '星巴克', '瑞幸'], name: '饮品咖啡', emoji: '☕', type: 'drink' },
  { keywords: ['车', '打车', '地铁', '高铁', '滴滴', '公交', '加油'], name: '打车交通', emoji: '🚖', type: 'traffic' },
  { keywords: ['游', '旅', '门票', '景点', '酒店', '民宿'], name: '旅行门票', emoji: '✈️', type: 'travel' },
  { keywords: ['书', '课', '教材'], name: '买书', emoji: '📖', type: 'book' }
];

function getCategoryInfo(name) {
  for (let i = 0; i < CATEGORY_MAP.length; i++) {
    const cat = CATEGORY_MAP[i];
    for (let k = 0; k < cat.keywords.length; k++) {
      if (name.includes(cat.keywords[k])) {
        return {
          tag: cat.name.slice(0, 1),
          emoji: cat.emoji,
          type: cat.type
        };
      }
    }
  }
  return { tag: name.slice(0, 1) || '账', emoji: '🏷️', type: 'other' };
}

function extractTags(note) {
  if (!note) return [];
  const tags = [];
  const matches = note.match(/[A-Za-z]+/g);
  if (matches) {
    matches.forEach(m => {
      const upper = m.toUpperCase();
      if (!tags.includes(upper)) tags.push(upper);
    });
  }
  return tags;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/(\d{1,2})[\.\-\/月](\d{1,2})/);
  if (match) {
    return `${match[1]}月${match[2]}日`;
  }
  return dateStr;
}

function getTodayString() {
  const now = new Date();
  return `${now.getMonth() + 1}.${now.getDate()}`;
}

function parseHabitsString(str) {
  if (!str) return [];
  if (/[，,;；]/.test(str)) {
    return str.split(/[，,;；]+/).map(s => s.trim()).filter(Boolean);
  }
  const tokens = str.trim().split(/\s+/);
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const isEmojiOnly = /\p{Extended_Pictographic}/u.test(cur) && !/[\u4e00-\u9fa5A-Za-z0-9]/.test(cur);
    if (isEmojiOnly && i + 1 < tokens.length) {
      result.push(`${cur} ${tokens[i + 1]}`);
      i++;
    } else {
      result.push(cur);
    }
  }
  return result;
}

function parseBillText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const groups = [];
  let currentDate = '';
  let currentItems = [];
  let currentNotes = [];
  let currentBook = null;
  let currentTravel = null;
  let currentTags = [];

  function commitCurrentGroup() {
    if (!currentDate && currentItems.length === 0 && currentNotes.length === 0 && !currentBook && !currentTravel && currentTags.length === 0) return;
    const finalDate = currentDate || getTodayString();
    
    const sum = currentItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const total = Math.round(sum * 100) / 100;
    const noteText = currentNotes.join('  ');

    const groupObj = {
      id: 'date_' + finalDate.replace(/[\.\-\/月日]/g, '_') + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      date: finalDate,
      dateDisplay: formatDateDisplay(finalDate),
      items: currentItems,
      total: total,
      note: noteText,
      tags: currentTags.length > 0 ? Array.from(new Set(currentTags)) : extractTags(noteText)
    };

    if (currentBook) {
      groupObj.book = currentBook;
    }
    if (currentTravel) {
      groupObj.travel = currentTravel;
    }

    groups.push(groupObj);

    currentItems = [];
    currentNotes = [];
    currentBook = null;
    currentTravel = null;
    currentTags = [];
    currentDate = '';
  }

  const dateRegex = /^(\d{4}[\.\-\/])?(\d{1,2}[\.\-\/]\d{1,2}|\d{1,2}月\d{1,2}日?)$/;
  const itemRegex = /^(.+?)[\s:：]+([¥￥]?\s*\d+(\.\d+)?)\s*元?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^(合计|总计|总共|共计|支出合计)/.test(line)) {
      continue;
    }

    if (dateRegex.test(line)) {
      commitCurrentGroup();
      currentDate = line;
      continue;
    }

    // 1. 识别读书随记：如 "看书 《置身事内》 读完第3章: 地方政府与城市投资..." 或 "📖 《纳瓦尔宝典》 50%: 专长是..."
    const bookMatch = line.match(/^(?:看书|读书|📖)\s*(.+)$/);
    if (bookMatch) {
      const rest = bookMatch[1].trim();
      let title = '';
      let progress = '阅读中';
      let quote = '';
      
      let preQuote = rest;
      const colonIdx = rest.search(/[:：]/);
      if (colonIdx >= 0) {
        preQuote = rest.slice(0, colonIdx).trim();
        quote = rest.slice(colonIdx + 1).trim();
      }

      const titleMatch = preQuote.match(/《([^》]+)》/);
      if (titleMatch) {
        title = `《${titleMatch[1]}》`;
        const rem = preQuote.replace(titleMatch[0], '').trim();
        if (rem) progress = rem;
      } else {
        const parts = preQuote.split(/\s+/);
        title = `《${parts[0].replace(/^[《]+|[》]+$/g, '')}》`;
        if (parts.length > 1) {
          progress = parts.slice(1).join(' ');
        }
      }

      currentBook = { title, progress, quote };
      continue;
    }

    // 2. 识别旅途足迹：如 "旅行 苏州平江路 (周末漫游): 烟雨江南，听评弹声声入耳。"
    const travelMatch = line.match(/^(?:旅行|旅游|游玩|漫游|✈️)\s*(.+)$/);
    if (travelMatch) {
      const rest = travelMatch[1].trim();
      let location = '';
      let tag = '漫游';
      let notes = '';

      let preNotes = rest;
      const colonIdx = rest.search(/[:：]/);
      if (colonIdx >= 0) {
        preNotes = rest.slice(0, colonIdx).trim();
        notes = rest.slice(colonIdx + 1).trim();
      }

      const tagMatch = preNotes.match(/[（(]([^）)]+)[）)]/);
      if (tagMatch) {
        tag = tagMatch[1];
        location = preNotes.replace(tagMatch[0], '').trim();
      } else {
        location = preNotes.trim();
      }

      currentTravel = { location: location || '城市漫游', tag, notes };
      continue;
    }

    // 3. 识别打卡：如 "打卡: 🏃 健身 🌙 早睡 💧 8杯水" 或 "打卡 🏃 健身 💧 8杯水"
    const habitMatch = line.match(/^(?:打卡|生活打卡|习惯打卡|⚡)\s*[:：]?\s*(.+)$/);
    if (habitMatch) {
      const tagStr = habitMatch[1].trim();
      const habits = parseHabitsString(tagStr);
      currentTags = currentTags.concat(habits);
      continue;
    }

    // 4. 识别消费账目：如 "早饭 16.7"、"房租 2600"、"美团小象超市:39.8"
    const itemMatch = line.match(itemRegex);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const amountStr = itemMatch[2].replace(/[¥￥\s]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount)) {
        const catInfo = getCategoryInfo(name);
        currentItems.push({
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: name,
          amount: Math.round(amount * 100) / 100,
          emoji: catInfo.emoji,
          tag: catInfo.tag,
          type: catInfo.type
        });
        continue;
      }
    }

    currentNotes.push(line);
  }

  commitCurrentGroup();
  return groups;
}

module.exports = {
  parseBillText,
  getCategoryInfo,
  extractTags,
  formatDateDisplay,
  getTodayString,
  CATEGORY_MAP
};
