// pages/asset/asset.js
const {
  getAccounts,
  getTotalAssets,
  getAssetLogs,
  addAccount,
  deleteAccount,
  adjustAccountBalance,
  depositToAccount,
  transferBetweenAccounts,
  getAssetPrivacy,
  setAssetPrivacy
} = require('../../utils/storage.js');
const { autoSyncOnLaunch } = require('../../utils/cloud_sync.js');

const ACCOUNT_EMOJIS = ['🟢', '🔵', '💳', '💵', '🏦', '💎', '📈', '🐷', '🪙', '💼', '🛒', '🏡'];

Page({
  data: {
    accounts: [],
    totalAssets: '0.00',
    isPrivacyHide: false,
    logs: [],
    
    // 快捷弹窗状态
    showDepositModal: false,
    depositAccountId: '',
    depositAmount: '',
    depositNote: '',

    showTransferModal: false,
    transferFromId: '',
    transferToId: '',
    transferAmount: '',
    transferNote: '',

    showCalibrateModal: false,
    calibrateAccountId: '',
    calibrateBalance: '',
    calibrateReason: '',

    showAddAccModal: false,
    newAccName: '',
    newAccEmoji: '💳',
    newAccBalance: '',
    newAccType: 'other',
    emojiList: ACCOUNT_EMOJIS
  },

  onLoad() {
    this.refreshAssetData();
  },

  onShow() {
    this.refreshAssetData();
  },

  onPullDownRefresh() {
    this.refreshAssetData();
    autoSyncOnLaunch(() => {
      this.refreshAssetData();
      wx.stopPullDownRefresh();
    });
  },

  refreshAssetData() {
    const rawAccounts = getAccounts();
    const isPrivacy = getAssetPrivacy();
    const total = getTotalAssets(rawAccounts);
    const numTotal = parseFloat(total) || 0;

    const accounts = rawAccounts.map(acc => {
      const b = typeof acc.balance === 'number' ? acc.balance : parseFloat(acc.balance) || 0;
      const percent = (numTotal > 0 && b > 0) ? Math.min(100, Math.round((b / numTotal) * 100)) : 0;
      return {
        ...acc,
        balanceDisplay: (Math.round(b * 100) / 100).toFixed(2),
        percent: percent
      };
    });

    const rawLogs = getAssetLogs();
    const logs = (rawLogs || []).slice(0, 30).map(log => {
      const d = new Date(log.time || Date.now());
      const m = d.getMonth() + 1;
      const date = d.getDate();
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const timeStr = `${m}.${date} ${h}:${min}`;

      let typeBadge = '支出';
      let typeClass = 'type-expense';
      let sign = '-';
      if (log.type === 'income') {
        typeBadge = '存入';
        typeClass = 'type-income';
        sign = '+';
      } else if (log.type === 'transfer') {
        typeBadge = '转账';
        typeClass = 'type-transfer';
        sign = '';
      } else if (log.type === 'adjust') {
        typeBadge = '校准';
        typeClass = 'type-adjust';
        sign = (log.amount >= 0 ? '+' : '');
      } else if (log.type === 'refund') {
        typeBadge = '回退';
        typeClass = 'type-refund';
        sign = '+';
      }

      return {
        ...log,
        timeStr,
        typeBadge,
        typeClass,
        sign,
        amountDisplay: Math.abs(log.amount).toFixed(2),
        balanceAfterDisplay: log.balanceAfter !== null && log.balanceAfter !== undefined ? Number(log.balanceAfter).toFixed(2) : ''
      };
    });

    this.setData({
      accounts,
      totalAssets: total,
      isPrivacyHide: isPrivacy,
      logs
    });
  },

  togglePrivacy() {
    const next = !this.data.isPrivacyHide;
    setAssetPrivacy(next);
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) {}
    this.setData({ isPrivacyHide: next });
  },

  // ---------------- 存入 / 收入 ----------------
  openDepositModal(e) {
    const accId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) 
      || (this.data.accounts[0] ? this.data.accounts[0].id : '');
    this.setData({
      showDepositModal: true,
      depositAccountId: accId,
      depositAmount: '',
      depositNote: ''
    });
  },

  closeDepositModal() {
    this.setData({ showDepositModal: false });
  },

  onDepositAccChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const target = this.data.accounts[idx];
    if (target) {
      this.setData({ depositAccountId: target.id });
    }
  },

  onDepositAmountInput(e) {
    this.setData({ depositAmount: e.detail.value });
  },

  onDepositNoteInput(e) {
    this.setData({ depositNote: e.detail.value });
  },

  submitDeposit() {
    const { depositAccountId, depositAmount, depositNote } = this.data;
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    depositToAccount(depositAccountId, num, depositNote || '存入资金/收入');
    wx.showToast({ title: '存入成功', icon: 'success' });
    this.closeDepositModal();
    this.refreshAssetData();
  },

  // ---------------- 内部转账 ----------------
  openTransferModal() {
    const accs = this.data.accounts;
    const fromId = accs[0] ? accs[0].id : '';
    const toId = accs[1] ? accs[1].id : (accs[0] ? accs[0].id : '');
    this.setData({
      showTransferModal: true,
      transferFromId: fromId,
      transferToId: toId,
      transferAmount: '',
      transferNote: ''
    });
  },

  closeTransferModal() {
    this.setData({ showTransferModal: false });
  },

  onTransferFromChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const target = this.data.accounts[idx];
    if (target) {
      this.setData({ transferFromId: target.id });
    }
  },

  onTransferToChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const target = this.data.accounts[idx];
    if (target) {
      this.setData({ transferToId: target.id });
    }
  },

  onTransferAmountInput(e) {
    this.setData({ transferAmount: e.detail.value });
  },

  onTransferNoteInput(e) {
    this.setData({ transferNote: e.detail.value });
  },

  submitTransfer() {
    const { transferFromId, transferToId, transferAmount, transferNote } = this.data;
    if (transferFromId === transferToId) {
      wx.showToast({ title: '转出与转入账户不能相同', icon: 'none' });
      return;
    }
    const num = parseFloat(transferAmount);
    if (isNaN(num) || num <= 0) {
      wx.showToast({ title: '请输入有效转账金额', icon: 'none' });
      return;
    }
    const success = transferBetweenAccounts(transferFromId, transferToId, num, transferNote || '账户互转');
    if (!success) {
      wx.showToast({ title: '转账失败，请检查账户', icon: 'none' });
      return;
    }
    wx.showToast({ title: '转账成功', icon: 'success' });
    this.closeTransferModal();
    this.refreshAssetData();
  },

  // ---------------- 余额校准 ----------------
  openCalibrateModal(e) {
    const accId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) 
      || (this.data.accounts[0] ? this.data.accounts[0].id : '');
    const target = this.data.accounts.find(a => a.id === accId) || this.data.accounts[0];
    this.setData({
      showCalibrateModal: true,
      calibrateAccountId: target ? target.id : '',
      calibrateBalance: target ? target.balanceDisplay : '',
      calibrateReason: ''
    });
  },

  closeCalibrateModal() {
    this.setData({ showCalibrateModal: false });
  },

  onCalibrateAccChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const target = this.data.accounts[idx];
    if (target) {
      this.setData({
        calibrateAccountId: target.id,
        calibrateBalance: target.balanceDisplay
      });
    }
  },

  onCalibrateBalanceInput(e) {
    this.setData({ calibrateBalance: e.detail.value });
  },

  onCalibrateReasonInput(e) {
    this.setData({ calibrateReason: e.detail.value });
  },

  submitCalibrate() {
    const { calibrateAccountId, calibrateBalance, calibrateReason } = this.data;
    const num = parseFloat(calibrateBalance);
    if (isNaN(num)) {
      wx.showToast({ title: '请输入实际余额', icon: 'none' });
      return;
    }
    adjustAccountBalance(calibrateAccountId, num, calibrateReason || '手动校准对账');
    wx.showToast({ title: '校准完成', icon: 'success' });
    this.closeCalibrateModal();
    this.refreshAssetData();
  },

  // ---------------- 新建账户 ----------------
  openAddAccModal() {
    this.setData({
      showAddAccModal: true,
      newAccName: '',
      newAccEmoji: '💳',
      newAccBalance: '',
      newAccType: 'bank'
    });
  },

  closeAddAccModal() {
    this.setData({ showAddAccModal: false });
  },

  onNewAccNameInput(e) {
    this.setData({ newAccName: e.detail.value });
  },

  onSelectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ newAccEmoji: emoji });
  },

  onNewAccBalanceInput(e) {
    this.setData({ newAccBalance: e.detail.value });
  },

  submitAddAccount() {
    const { newAccName, newAccEmoji, newAccBalance, newAccType } = this.data;
    if (!newAccName || !newAccName.trim()) {
      wx.showToast({ title: '请输入账户名称', icon: 'none' });
      return;
    }
    const balance = parseFloat(newAccBalance) || 0;
    addAccount({
      name: newAccName.trim(),
      emoji: newAccEmoji,
      balance,
      type: newAccType
    });
    wx.showToast({ title: '账户创建成功', icon: 'success' });
    this.closeAddAccModal();
    this.refreshAssetData();
  },

  // ---------------- 删除账户 ----------------
  handleDeleteAccount(e) {
    const accId = e.currentTarget.dataset.id;
    const target = this.data.accounts.find(a => a.id === accId);
    if (!target) return;

    wx.showModal({
      title: '确认删除账户？',
      content: `删除「${target.name}」后，该账户余额将清空。已记录的历史账单条目不受影响。`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          deleteAccount(accId);
          wx.showToast({ title: '已删除', icon: 'none' });
          this.refreshAssetData();
        }
      }
    });
  }
});
