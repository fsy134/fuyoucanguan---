// 下单确认页：购物车清单（可增删）+ 备注 + 继续点餐/下单
const app = getApp();
const request = require('../../utils/request.js');
const util = require('../../utils/util.js');

Page({
  data: {
    cartList: [],
    totalText: '0.00',
    totalCents: 0,
    remark: '',
    tableNum: '',
    peopleCount: 0,
    submitting: false
  },

  onLoad() {
    this.setData({
      tableNum: wx.getStorageSync('TABLE_NUM') || '',
      peopleCount: app.globalData.peopleCount || 0
    });
  },

  onShow() {
    // 每次回到本页都拉最新购物车
    this.loadCart();
  },

  loadCart() {
    request.get('/user/shoppingCart/list').then((list) => {
      let totalCents = 0;
      (list || []).forEach((row) => {
        row.priceText = util.formatMoney(row.amount);
        totalCents += util.toCents(row.amount) * row.number;
      });
      this.setData({
        cartList: list || [],
        totalCents: totalCents,
        totalText: util.centsToMoney(totalCents)
      });
    }).catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  // 行内 +/- 的参数必须与加购时完全一致（口味字符串原样回传，不重新拼接）
  buildBody(row) {
    const body = row.setmealId ? { setmealId: row.setmealId } : { dishId: row.dishId };
    if (row.dishFlavor) {
      body.dishFlavor = row.dishFlavor;
    }
    return body;
  },

  onPlus(e) {
    const row = this.data.cartList[e.currentTarget.dataset.index];
    request.post('/user/shoppingCart/add', this.buildBody(row))
      .then(() => this.loadCart())
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  onMinus(e) {
    const row = this.data.cartList[e.currentTarget.dataset.index];
    request.post('/user/shoppingCart/sub', this.buildBody(row))
      .then(() => this.loadCart())
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  // 清空购物车（二次确认）
  onClear() {
    wx.showModal({
      title: '清空购物车',
      content: '确定要把已点的菜全部清空吗？',
      confirmColor: '#d9822b',
      success: (res) => {
        if (res.confirm) {
          request.del('/user/shoppingCart/clean')
            .then(() => this.loadCart())
            .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
        }
      }
    });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 继续点餐：返回点餐页
  onBack() {
    if (getCurrentPages().length <= 1) {
      wx.redirectTo({ url: '/pages/menu/index' });
    } else {
      wx.navigateBack();
    }
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.cartList.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      return;
    }
    // 下单前再查一次营业状态兜底（防止点餐中途打烊）
    request.get('/user/shop/status').then((status) => {
      if (status !== 1) {
        wx.redirectTo({ url: '/pages/closed/index?reason=closed' });
        return;
      }
      this.doSubmit();
    }).catch(() => this.doSubmit()); // 状态查不到也放行，避免影响正常下单
  },

  doSubmit() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '下单中' });
    request.post('/user/order/submit', {
      payMethod: 1,
      remark: this.data.remark,
      amount: Number(this.data.totalCents) / 100,
      tableNum: this.data.tableNum
    }).then((order) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      // 下单成功后购物车已被后端清空，直接跳到订单详情页
      wx.redirectTo({ url: '/pages/order/detail?id=' + order.id });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: err.message, icon: 'none' });
    });
  }
});
