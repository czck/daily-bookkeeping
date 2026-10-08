// pages/asset/asset.js
const {
  getAccounts,
  getTotalAssets,
  getAssetLogs,
  addAccount,
  updateAccount,
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
    isTotalNegative: false,
    absTotalAssets: '0.00',
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
    calibrateSign: '+',
    calibrateBalanceAbs: '',
    calibrateReason: '',

    showAddAccModal: false,
    newAccName: '',
    newAccEmoji: '💳',
    newAccSign: '+',
    newAccBalanceAbs: '',
    newAccType: 'other',
    emojiList: ACCOUNT_EMOJIS,

    showEditAccModal: false,
    editAccId: '',
    editAccName: '',
    editAccEmoji: '💳'
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
    const isTotalNegative = numTotal < 0;
    const absTotalAssets = Math.abs(numTotal).toFixed(2);

    const accounts = rawAccounts.map(acc => {
      const b = typeof acc.balance === 'number' ? acc.balance : parseFloat(acc.balance) || 0;
      const isNegative = b < 0;
      const absVal = Math.abs(b);
      const absDisplay = (Math.round(absVal * 100) / 100).toFixed(2);
      const balanceDisplay = (Math.round(b * 100) / 100).toFixed(2);
      const formattedBalance = isNegative ? `-¥${absDisplay}` : `¥${balanceDisplay}`;
      const percent = (numTotal > 0 && b > 0) ? Math.min(100, Math.round((b / numTotal) * 100)) : 0;
      return {
        ...acc,
        balance: b,
        isNegative,
        absDisplay,
        balanceDisplay,
        formattedBalance,
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
      isTotalNegative,
      absTotalAssets,
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

  // ---------------- 余额校准 (支持正负数/负债) ----------------
  openCalibrateModal(e) {
    const accId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) 
      || (this.data.accounts[0] ? this.data.accounts[0].id : '');
    const target = this.data.accounts.find(a => a.id === accId) || this.data.accounts[0];
    const isNeg = target ? target.isNegative : false;
    this.setData({
      showCalibrateModal: true,
      calibrateAccountId: target ? target.id : '',
      calibrateSign: isNeg ? '-' : '+',
      calibrateBalanceAbs: target ? target.absDisplay : '',
      calibrateReason: ''
    });
  },

  closeCalibrateModal() {
    this.setData({ showCalibrateModal: false });
  },

  setCalibrateSign(e) {
    const sign = e.currentTarget.dataset.sign;
    this.setData({ calibrateSign: sign });
  },

  onCalibrateAccChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const target = this.data.accounts[idx];
    if (target) {
      this.setData({
        calibrateAccountId: target.id,
        calibrateSign: target.isNegative ? '-' : '+',
        calibrateBalanceAbs: target.absDisplay
      });
    }
  },

  onCalibrateBalanceInput(e) {
    let val = e.detail.value;
    if (val.startsWith('-')) {
      this.setData({
        calibrateSign: '-',
        calibrateBalanceAbs: val.replace(/^-+/, '')
      });
    } else {
      this.setData({ calibrateBalanceAbs: val });
    }
  },

  onCalibrateReasonInput(e) {
    this.setData({ calibrateReason: e.detail.value });
  },

  submitCalibrate() {
    const { calibrateAccountId, calibrateSign, calibrateBalanceAbs, calibrateReason } = this.data;
    const absNum = parseFloat(calibrateBalanceAbs);
    if (isNaN(absNum)) {
      wx.showToast({ title: '请输入实际余额', icon: 'none' });
      return;
    }
    const finalBalance = (calibrateSign === '-' ? -1 : 1) * Math.abs(absNum);
    adjustAccountBalance(calibrateAccountId, finalBalance, calibrateReason || '手动校准对账');
    wx.showToast({ title: '校准完成', icon: 'success' });
    this.closeCalibrateModal();
    this.refreshAssetData();
  },

  // ---------------- 新建账户 (支持负债/负数设定) ----------------
  openAddAccModal() {
    this.setData({
      showAddAccModal: true,
      newAccName: '',
      newAccEmoji: '💳',
      newAccSign: '+',
      newAccBalanceAbs: '',
      newAccType: 'other'
    });
  },

  closeAddAccModal() {
    this.setData({ showAddAccModal: false });
  },

  setNewAccSign(e) {
    const sign = e.currentTarget.dataset.sign;
    this.setData({ newAccSign: sign });
  },

  onNewAccNameInput(e) {
    this.setData({ newAccName: e.detail.value });
  },

  onSelectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ newAccEmoji: emoji });
  },

  onNewAccBalanceInput(e) {
    let val = e.detail.value;
    if (val.startsWith('-')) {
      this.setData({
        newAccSign: '-',
        newAccBalanceAbs: val.replace(/^-+/, '')
      });
    } else {
      this.setData({ newAccBalanceAbs: val });
    }
  },

  submitAddAccount() {
    const { newAccName, newAccEmoji, newAccSign, newAccBalanceAbs, newAccType } = this.data;
    if (!newAccName || !newAccName.trim()) {
      wx.showToast({ title: '请输入账户名称', icon: 'none' });
      return;
    }
    const absVal = parseFloat(newAccBalanceAbs) || 0;
    const finalBalance = (newAccSign === '-' ? -1 : 1) * Math.abs(absVal);
    addAccount({
      name: newAccName.trim(),
      emoji: newAccEmoji,
      balance: finalBalance,
      type: newAccType
    });
    wx.showToast({ title: '账户创建成功', icon: 'success' });
    this.closeAddAccModal();
    this.refreshAssetData();
  },

  // ---------------- 修改账户 (重命名 / 图标) ----------------
  openEditAccModal(e) {
    const accId = e.currentTarget.dataset.id;
    const target = this.data.accounts.find(a => a.id === accId);
    if (!target) return;
    this.setData({
      showEditAccModal: true,
      editAccId: target.id,
      editAccName: target.name,
      editAccEmoji: target.emoji || '💳'
    });
  },

  closeEditAccModal() {
    this.setData({ showEditAccModal: false });
  },

  onEditAccNameInput(e) {
    this.setData({ editAccName: e.detail.value });
  },

  onSelectEditAccEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ editAccEmoji: emoji });
  },

  submitEditAccount() {
    const { editAccId, editAccName, editAccEmoji } = this.data;
    if (!editAccName || !editAccName.trim()) {
      wx.showToast({ title: '请输入账户名称', icon: 'none' });
      return;
    }
    const updated = updateAccount({
      id: editAccId,
      name: editAccName.trim(),
      emoji: editAccEmoji
    });
    if (updated) {
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.closeEditAccModal();
      this.refreshAssetData();
    } else {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
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
