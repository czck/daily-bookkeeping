// app.js
const { getBills } = require('./utils/storage.js');
const { initCloud, autoSyncOnLaunch } = require('./utils/cloud_sync.js');

App({
  onLaunch() {
    console.log('日常小账启动中...');
    // 1. 确保本地存储可用
    getBills();
    
    // 2. 初始化微信云开发并执行自动双向同步
    initCloud();
    autoSyncOnLaunch((success, hasNewData) => {
      if (success) {
        console.log('[App] 微信云端同步检查完成', hasNewData ? '已更新本地数据' : '数据已是最新');
      }
    });
  },
  globalData: {
    appName: '日常小账'
  }
});

