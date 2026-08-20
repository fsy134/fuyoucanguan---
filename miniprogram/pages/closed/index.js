// 打烊提示页：营业状态关闭或未设置时进入
const request = require('../../utils/request.js');

Page({
  data: {
    // reason: closed=打烊中  unknown=营业状态未设置
    reason: 'closed'
  },

  onLoad(options) {
    this.setData({ reason: options.reason || 'closed' });
  },

  // 重新检查营业状态
  recheck() {
    wx.showLoading({ title: '检查中…' });
    request.get('/user/shop/status').then((status) => {
      wx.hideLoading();
      if (status === 1) {
        wx.redirectTo({ url: '/pages/menu/index' });
      } else {
        wx.showToast({ title: '本店已打烊', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '营业状态未设置，请联系商家', icon: 'none' });
    });
  }
});
