// 选桌页：顾客没扫码、直接打开小程序时的兜底入口
const config = require('../../config.js');

Page({
  data: {
    shopName: config.shopName,
    shopBg: config.shopBg,
    tables: []
  },

  onLoad() {
    // 已经知道桌号（比如刚扫过码）-> 直接进点餐页
    if (wx.getStorageSync('TABLE_NUM')) {
      wx.redirectTo({ url: '/pages/menu/index' });
      return;
    }
    // 生成 1~N 号桌的宫格
    const tables = [];
    for (let i = 1; i <= config.tableCount; i++) {
      tables.push(i);
    }
    this.setData({ tables });
  },

  // 顾客点选桌号 -> 记住 -> 进点餐页
  chooseTable(e) {
    const num = String(e.currentTarget.dataset.num);
    wx.setStorageSync('TABLE_NUM', num);
    getApp().globalData.tableNum = num;
    wx.redirectTo({ url: '/pages/menu/index' });
  }
});
