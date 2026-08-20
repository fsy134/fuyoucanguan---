// 历史订单页：分页列表 + 状态筛选 + 再来一单
const request = require('../../utils/request.js');
const util = require('../../utils/util.js');

Page({
  data: {
    // 状态筛选：1待付款 5已完成 6已取消
    tabs: [
      { label: '全部', value: '' },
      { label: '待付款', value: 1 },
      { label: '已完成', value: 5 },
      { label: '已取消', value: 6 }
    ],
    activeStatus: '',
    orders: [],
    page: 1,
    pageSize: 10,
    total: 0,
    loading: false,
    finished: false
  },

  onLoad() {
    this.loadOrders(true);
  },

  // 切换状态筛选
  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.activeStatus) return;
    this.setData({ activeStatus: status });
    this.loadOrders(true);
  },

  // 加载订单：reset=true 从第一页开始，false 加载下一页
  loadOrders(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    let url = '/user/order/historyOrders?page=' + page + '&pageSize=' + this.data.pageSize;
    if (this.data.activeStatus !== '') {
      url += '&status=' + this.data.activeStatus;
    }
    request.get(url).then((res) => {
      const records = (res.records || []).map((order) => {
        const statusMap = {
          1: { text: '待付款', cls: 's-pending' },
          5: { text: '已完成', cls: 's-done' },
          6: { text: '已取消', cls: 's-canceled' }
        };
        order.statusInfo = statusMap[order.status] || { text: '处理中', cls: 's-pending' };
        order.amountText = util.formatMoney(order.amount);
        // 列表摘要：宫保鸡丁 x1、米饭 x2
        order.summary = (order.orderDetailList || [])
          .map((d) => d.name + ' x' + d.number).join('、');
        return order;
      });
      const orders = reset ? records : this.data.orders.concat(records);
      this.setData({
        orders: orders,
        page: page,
        total: res.total || 0,
        loading: false,
        finished: orders.length >= (res.total || 0)
      });
    }).catch((err) => {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    });
  },

  // 滚动到底部加载下一页
  onReachBottom() {
    if (!this.data.finished) {
      this.loadOrders(false);
    }
  },

  // 点订单卡片 -> 订单详情页
  goDetail(e) {
    wx.navigateTo({ url: '/pages/order/detail?id=' + e.currentTarget.dataset.id });
  },

  // 再来一单：先清空购物车，再把订单明细塞回购物车
  onReorder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '再来一单',
      content: '把这单的菜重新加入购物车？',
      confirmColor: '#d9822b',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '加入中' });
        request.del('/user/shoppingCart/clean')
          .then(() => request.post('/user/order/repetition/' + id))
          .then(() => {
            wx.hideLoading();
            wx.showModal({
              title: '已加入购物车',
              content: '返回点餐页继续下单？',
              confirmText: '去点餐',
              confirmColor: '#d9822b',
              success: (r) => {
                if (r.confirm) this.backToMenu();
              }
            });
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showToast({ title: err.message, icon: 'none' });
          });
      }
    });
  },

  // 返回点餐页（带栈判断，防止直接打开本页时无路可退）
  backToMenu() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    } else {
      wx.redirectTo({ url: '/pages/menu/index' });
    }
  },

  goOrder() {
    this.backToMenu();
  }
});
