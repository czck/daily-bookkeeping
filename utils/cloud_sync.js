/**
 * 微信云端同步核心服务模块 (Local-First Hybrid Sync)
 * 环境ID: cloud1-d6gf9xvnb2785cca8
 * 集合名称: daily_bills
 */

const CLOUD_ENV_ID = 'cloud1-d6gf9xvnb2785cca8';
const COLLECTION_NAME = 'daily_bills';
const LOCAL_UPDATED_KEY = 'CLOUD_SYNC_LOCAL_UPDATED_AT_V1';
const LAST_SYNC_TIME_KEY = 'CLOUD_SYNC_LAST_SUCCESS_TIME_V1';

let isCloudInited = false;
let cachedDocId = null;
let syncDebounceTimer = null;
let currentSyncStatus = {
  connected: false,
  statusText: '正在连接微信云端...',
  lastSyncTime: '',
  isSyncing: false
};

// 状态监听订阅者列表
const statusListeners = [];

function notifyListeners() {
  statusListeners.forEach(fn => {
    try { fn(currentSyncStatus); } catch (e) {}
  });
}

function subscribeSyncStatus(fn) {
  if (typeof fn === 'function') {
    statusListeners.push(fn);
    fn(currentSyncStatus);
  }
}

/**
 * 格式化最后同步时间提示
 */
function formatSyncTime(ts) {
  if (!ts) return '未同步';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `今日 ${h}:${m}`;
}

/**
 * 初始化微信云开发环境
 */
function initCloud() {
  if (isCloudInited) return true;
  if (!wx.cloud) {
    currentSyncStatus = {
      connected: false,
      statusText: '当前基础库不支持微信云开发',
      lastSyncTime: '',
      isSyncing: false
    };
    notifyListeners();
    return false;
  }

  try {
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });
    isCloudInited = true;
    const lastTime = wx.getStorageSync(LAST_SYNC_TIME_KEY) || 0;
    currentSyncStatus = {
      connected: true,
      statusText: '已连接微信云端',
      lastSyncTime: formatSyncTime(lastTime),
      isSyncing: false
    };
    notifyListeners();
    return true;
  } catch (err) {
    console.error('[云同步] 初始化异常', err);
    currentSyncStatus = {
      connected: false,
      statusText: '云环境连接失败: ' + (err.message || '未知错误'),
      lastSyncTime: '',
      isSyncing: false
    };
    notifyListeners();
    return false;
  }
}

/**
 * 获取当前用户的云端账本数据文档
 */
async function getCloudUserDoc() {
  if (!initCloud()) return null;
  const db = wx.cloud.database();
  try {
    const res = await db.collection(COLLECTION_NAME).limit(1).get();
    if (res.data && res.data.length > 0) {
      cachedDocId = res.data[0]._id;
      return res.data[0];
    }
    return null;
  } catch (e) {
    console.error('[云同步] 读取云端集合失败', e);
    throw e;
  }
}

/**
 * 将本地全量数据上传/覆盖至云端
 */
async function uploadToCloud(payload) {
  if (!initCloud()) throw new Error('云开发未初始化');
  const db = wx.cloud.database();
  const now = Date.now();

  const dataToSave = {
    bills: payload.bills || [],
    habits: payload.habits || [],
    customCategories: payload.customCategories || [],
    updatedAt: now,
    deviceInfo: 'mini-program',
    appVersion: '2.0.0'
  };

  currentSyncStatus.isSyncing = true;
  currentSyncStatus.statusText = '正在静默同步至云端...';
  notifyListeners();

  try {
    if (cachedDocId) {
      // 已有云端文档，直接更新
      await db.collection(COLLECTION_NAME).doc(cachedDocId).set({
        data: dataToSave
      });
    } else {
      // 先探测是否已有
      const existing = await getCloudUserDoc();
      if (existing) {
        await db.collection(COLLECTION_NAME).doc(existing._id).set({
          data: dataToSave
        });
        cachedDocId = existing._id;
      } else {
        // 创建第一条云端文档
        const addRes = await db.collection(COLLECTION_NAME).add({
          data: dataToSave
        });
        cachedDocId = addRes._id;
      }
    }

    wx.setStorageSync(LOCAL_UPDATED_KEY, now);
    wx.setStorageSync(LAST_SYNC_TIME_KEY, now);

    currentSyncStatus = {
      connected: true,
      statusText: '已成功同步至云端',
      lastSyncTime: '刚刚',
      isSyncing: false
    };
    notifyListeners();
    return true;
  } catch (err) {
    console.error('[云同步] 上传云端失败', err);
    currentSyncStatus = {
      connected: false,
      statusText: '同步遇到问题，已保存在本地',
      lastSyncTime: formatSyncTime(wx.getStorageSync(LAST_SYNC_TIME_KEY) || 0),
      isSyncing: false
    };
    notifyListeners();
    throw err;
  }
}

/**
 * 本地数据发生增删改时触发防抖静默同步
 */
function notifyDataChanged() {
  wx.setStorageSync(LOCAL_UPDATED_KEY, Date.now());

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    try {
      const storage = require('./storage.js');
      const bills = storage.getBills();
      const habits = storage.getCustomHabits();
      const customCategories = storage.getCustomCategories();
      await uploadToCloud({ bills, habits, customCategories });
      console.log('[云同步] 静默自动同步完成');
    } catch (e) {
      console.warn('[云同步] 后台静默同步失败，稍后重试', e.message);
    }
  }, 1200);
}

/**
 * 启动时智能双向自动同步
 * - 若云端有而本地无（换机/重装）：自动拉取覆盖本地
 * - 若本地有而云端无（首次开通）：自动上传填满云端
 * - 若双端均有：按最新修改时间戳自动同步
 */
async function autoSyncOnLaunch(onFinished) {
  if (!initCloud()) {
    if (onFinished) onFinished(false);
    return;
  }

  try {
    const storage = require('./storage.js');
    const localBills = storage.getBills();
    const localUpdated = wx.getStorageSync(LOCAL_UPDATED_KEY) || 0;

    const cloudDoc = await getCloudUserDoc();

    if (!cloudDoc) {
      // 云端尚无数据
      if (localBills && localBills.length > 0) {
        console.log('[云同步] 首次开通云端，自动上传本地全部手账到云端');
        const habits = storage.getCustomHabits();
        const customCategories = storage.getCustomCategories();
        await uploadToCloud({ bills: localBills, habits, customCategories });
      }
      if (onFinished) onFinished(true);
      return;
    }

    // 云端已有数据
    const cloudUpdated = cloudDoc.updatedAt || 0;
    const cloudBills = cloudDoc.bills || [];

    if (!localBills || localBills.length === 0) {
      // 本地无数据，直接从云端全量恢复
      console.log('[云同步] 本地为空，自动从云端拉取恢复');
      storage.setBills(cloudBills);
      if (cloudDoc.habits && Array.isArray(cloudDoc.habits)) {
        wx.setStorageSync('MY_CUSTOM_HABITS_LIST_V1', cloudDoc.habits);
      }
      if (cloudDoc.customCategories && Array.isArray(cloudDoc.customCategories)) {
        wx.setStorageSync('MY_CUSTOM_CATEGORIES_LIST_V1', cloudDoc.customCategories);
      }
      wx.setStorageSync(LOCAL_UPDATED_KEY, cloudUpdated);
      wx.setStorageSync(LAST_SYNC_TIME_KEY, Date.now());
      currentSyncStatus.lastSyncTime = '刚刚';
      notifyListeners();
      if (onFinished) onFinished(true, true); // 第二参数表示有数据更新
      return;
    }

    // 双端均有数据，对比时间戳
    if (cloudUpdated > localUpdated) {
      console.log('[云同步] 云端版本更新，从云端拉取更新');
      storage.setBills(cloudBills);
      if (cloudDoc.habits && Array.isArray(cloudDoc.habits)) {
        wx.setStorageSync('MY_CUSTOM_HABITS_LIST_V1', cloudDoc.habits);
      }
      if (cloudDoc.customCategories && Array.isArray(cloudDoc.customCategories)) {
        wx.setStorageSync('MY_CUSTOM_CATEGORIES_LIST_V1', cloudDoc.customCategories);
      }
      wx.setStorageSync(LOCAL_UPDATED_KEY, cloudUpdated);
      wx.setStorageSync(LAST_SYNC_TIME_KEY, Date.now());
      currentSyncStatus.lastSyncTime = '刚刚';
      notifyListeners();
      if (onFinished) onFinished(true, true);
    } else if (localUpdated > cloudUpdated) {
      console.log('[云同步] 本地有更新的修改，自动上传至云端');
      const habits = storage.getCustomHabits();
      const customCategories = storage.getCustomCategories();
      await uploadToCloud({ bills: localBills, habits, customCategories });
      if (onFinished) onFinished(true);
    } else {
      console.log('[云同步] 本地与云端已是最新');
      currentSyncStatus.lastSyncTime = formatSyncTime(wx.getStorageSync(LAST_SYNC_TIME_KEY) || Date.now());
      notifyListeners();
      if (onFinished) onFinished(true);
    }
  } catch (err) {
    console.warn('[云同步] 启动自动同步异常', err);
    if (onFinished) onFinished(false);
  }
}

/**
 * 手动强制一键上传到云端
 */
async function manualUpload() {
  const storage = require('./storage.js');
  const bills = storage.getBills();
  const habits = storage.getCustomHabits();
  const customCategories = storage.getCustomCategories();
  return await uploadToCloud({ bills, habits, customCategories });
}

/**
 * 手动强制从云端全量拉取
 */
async function manualDownload() {
  const cloudDoc = await getCloudUserDoc();
  if (!cloudDoc || !cloudDoc.bills) {
    throw new Error('云端暂无账本数据');
  }
  const storage = require('./storage.js');
  storage.setBills(cloudDoc.bills);
  if (cloudDoc.habits && Array.isArray(cloudDoc.habits)) {
    wx.setStorageSync('MY_CUSTOM_HABITS_LIST_V1', cloudDoc.habits);
  }
  if (cloudDoc.customCategories && Array.isArray(cloudDoc.customCategories)) {
    wx.setStorageSync('MY_CUSTOM_CATEGORIES_LIST_V1', cloudDoc.customCategories);
  }
  const now = Date.now();
  wx.setStorageSync(LOCAL_UPDATED_KEY, now);
  wx.setStorageSync(LAST_SYNC_TIME_KEY, now);
  currentSyncStatus.lastSyncTime = '刚刚';
  notifyListeners();
  return cloudDoc.bills;
}

module.exports = {
  CLOUD_ENV_ID,
  COLLECTION_NAME,
  initCloud,
  autoSyncOnLaunch,
  notifyDataChanged,
  manualUpload,
  manualDownload,
  subscribeSyncStatus,
  getSyncStatus: () => currentSyncStatus
};
