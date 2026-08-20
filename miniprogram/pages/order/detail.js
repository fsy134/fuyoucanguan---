// 订单详情页：状态展示 + 催单 + 付款 + 取消
const request = require('../../utils/request.js');
const util = require('../../utils/util.js');

Page({
  data: {
    orderId: 0,
    order: null,
    statusText: '',
    statusIcon: '',
    statusClass: '',
    amountText: '0.00',
    tableNum: '',
    canPay: false,     // 待付款 -> 显示"去付款"
    canCancel: false,  // 待付款 -> 显示"取消订单"
    canRemind: true,   // 已取消的订单不显示"催单"
    paying: false
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.id) || 0 });
  },

  onShow() {
    this.loadOrder();
  },

  loadOrder() {
    if (!this.data.orderId) return;
    request.get('/user/order/orderDetail/' + this.data.orderId).then((order) => {
      // 状态映射：1待付款 5已完成 6已取消（与后端常量一致）
      const statusMap = {
        1: { text: '待付款', icon: '🕐', cls: 'pending' },
        5: { text: '已完成', icon: '✅', cls: 'done' },
        6: { text: '已取消', icon: '❌', cls: 'canceled' }
      };
      const s = statusMap[order.status] || { text: '处理中', icon: '🍳', cls: 'pending' };
      (order.orderDetailList || []).forEach((row) => {
        row.priceText = util.formatMoney(row.amount);
      });
      this.setData({
        order: order,
        statusText: s.text,
        statusIcon: s.icon,
        statusClass: s.cls,
        amountText: util.formatMoney(order.amount),
        tableNum: order.tableNum || '',
        canPay: order.status === 1,
        canCancel: order.status === 1,
        canRemind: order.status !== 6
      });
    }).catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  // 催单：任何状态都可点，商家端会收到"对讲机"提醒
  onRemind() {
    request.get('/user/order/reminder/' + this.data.orderId).then(() => {
      wx.showToast({ title: '已催单，商家正在处理', icon: 'none' });
    }).catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  // 付款（当前为模拟支付：点了就算付成功）
  onPay() {
    if (this.data.paying) return;
    wx.showModal({
      title: '确认付款',
      content: '应付 ¥' + this.data.amountText + '（当前为模拟支付，不会真实扣款）',
      confirmColor: '#d9822b',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ paying: true });
        wx.showLoading({ title: '支付中' });
        request.put('/user/order/payment', {
          orderNumber: this.data.order.number,
          payMethod: 1
        }).then(() => {
          wx.hideLoading();
          this.setData({ paying: false });
          wx.showToast({ title: '支付成功', icon: 'success' });
          this.loadOrder();
        }).catch((err) => {
          wx.hideLoading();
          this.setData({ paying: false });
          wx.showToast({ title: err.message, icon: 'none' });
        });
      }
    });
  },

  // 取消订单（二次确认）
  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      confirmColor: '#d9822b',
      success: (res) => {
        if (res.confirm) {
          request.put('/user/order/cancel/' + this.data.orderId).then(() => {
            wx.showToast({ title: '订单已取消', icon: 'none' });
            this.loadOrder();
          }).catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
        }
      }
    });
  },

  // 返回点餐页
  onBackMenu() {
    if (getCurrentPages().length <= 1) {
      wx.redirectTo({ url: '/pages/menu/index' });
    } else {
      wx.navigateBack();
    }
  }
});
