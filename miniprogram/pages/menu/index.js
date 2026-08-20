// 点餐页：顶部店铺信息 + 左侧分类导航 + 右侧全部分类菜品连排（滚动联动）
const app = getApp();
const config = require('../../config.js');
const request = require('../../utils/request.js');
const util = require('../../utils/util.js');

// 页面各区块的固定高度（rpx），滚动联动全靠这些固定值算位置：
// 背景图是 2:1 的图（1500x750），全宽显示时高度固定 375rpx，不裁剪
const BG_H = 375;      // 背景图高度
const BANNER_H = 136;  // 桌号条（含上边距 40rpx）
const HEADER_H = 72;   // 分类小标题高度
const ROW_H = 230;     // 每行菜品卡片高度

Page({
  data: {
    shopName: config.shopName,
    shopNotice: config.shopNotice,
    businessHours: config.businessHours,
    shopBg: config.shopBg,
    shopLogo: config.shopLogo,
    tableNum: '',
    peopleCount: 0,
    showPeopleModal: false,
    peopleOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],

    // 菜单：sections 按顺序存放每个分类及其菜品
    sections: [],
    activeIndex: 0,     // 左侧高亮的分类下标
    scrollIntoId: '',   // 点左侧分类时，右侧滚动到的目标小节
    sideTop: 300,       // 左侧分类导航悬浮的起点（px，实测桌号条底部得到）
    loadingMenu: true,
    menuEmpty: false,

    // 加购弹窗
    popupShow: false,
    popupTitle: '',
    popupPrice: 0,
    popupPriceText: '',
    popupFlavors: [],
    popupDetailItems: [],
    popupTarget: {},
    // 可多选的口味维度名单（来自 config.js，传给加购弹窗）
    multiFlavorNames: config.multiFlavorNames,

    // 购物车球
    cartCount: 0,
    cartAmountText: '0.00'
  },

  // 非渲染数据（不放进 data，避免无关渲染）
  pxFactor: 1,          // rpx -> px 换算系数
  baseTop: 0,           // 头部（背景图+桌号条）的 px 高度：分类栏的初始悬浮起点
  sectionOffsets: [],   // 每个分类小节在滚动内容里的起始位置（px）
  spyLock: false,       // 点左侧跳转时短暂锁定自动高亮，防止两者打架

  onLoad() {
    // 没有桌号（顾客没扫码直接打开小程序）-> 先去选桌页
    const tableNum = wx.getStorageSync('TABLE_NUM');
    if (!tableNum) {
      wx.redirectTo({ url: '/pages/table/index' });
      return;
    }
    this.setData({ tableNum });
    this.checkShopStatus();
    this.askPeopleCount();
    this.loadMenuData();
  },

  onShow() {
    // 每次回到本页都刷新购物车球（含首次进入）
    if (this.data.tableNum) {
      this.refreshCart();
    }
  },

  // 查营业状态：打烊（或商家没设置）时跳到打烊页
  checkShopStatus() {
    request.get('/user/shop/status').then((status) => {
      if (status !== 1) {
        wx.redirectTo({ url: '/pages/closed/index?reason=closed' });
      }
    }).catch(() => {
      wx.redirectTo({ url: '/pages/closed/index?reason=unknown' });
    });
  },

  // 询问用餐人数：每次打开小程序问一次，只在前端显示
  askPeopleCount() {
    const peopleCount = app.globalData.peopleCount;
    if (peopleCount) {
      this.setData({ peopleCount });
    } else {
      this.setData({ showPeopleModal: true });
    }
  },

  choosePeople(e) {
    const num = e.currentTarget.dataset.num;
    app.globalData.peopleCount = num;
    this.setData({ peopleCount: num, showPeopleModal: false });
  },

  // ============ 菜单加载：所有分类菜品连成一个大列表 ============
  loadMenuData() {
    Promise.all([
      request.get('/user/category/list?type=1'), // 菜品分类
      request.get('/user/category/list?type=2')  // 套餐分类
    ]).then(async ([cats1, cats2]) => {
      const all = (cats1 || []).concat(cats2 || []);
      // 只显示启用的分类：套餐分类排上面，同类里按 sort 从小到大
      const cats = all.filter((c) => c.status === 1).sort((a, b) => {
        if (a.type !== b.type) return b.type - a.type;
        return a.sort - b.sort;
      });
      // 把"招牌菜"分类置顶（分类名在 config.js 里配置）
      const featuredIdx = cats.findIndex((c) => c.name === config.featuredCategoryName);
      if (featuredIdx > 0) {
        const featured = cats.splice(featuredIdx, 1)[0];
        featured.featured = true;
        cats.unshift(featured);
      }
      if (!cats.length) {
        this.setData({ sections: [], loadingMenu: false, menuEmpty: true });
        return;
      }
      // 按顺序把每个分类的菜品/套餐全部拉下来，拼成一个大列表
      const sections = [];
      for (const cat of cats) {
        let items = [];
        try {
          const url = cat.type === 1
            ? '/user/dish/list?categoryId=' + cat.id
            : '/user/setmeal/list?categoryId=' + cat.id;
          items = (await request.get(url)) || [];
        } catch (err) {
          items = []; // 单个分类加载失败不阻塞其他分类
        }
        items.forEach((item) => {
          item.priceText = util.formatMoney(item.price);
          item._type = cat.type; // 记住商品类型：1菜品 2套餐
        });
        sections.push({
          catId: cat.id,
          catName: cat.name,
          type: cat.type,
          featured: !!cat.featured,
          items: items
        });
      }
      const menuEmpty = sections.every((s) => !s.items.length);
      this.setData({ sections, loadingMenu: false, menuEmpty }, () => {
        this.computeOffsets();
      });
    }).catch((err) => {
      this.setData({ loadingMenu: false, menuEmpty: true });
      wx.showToast({ title: err.message, icon: 'none' });
    });
  },

  // 计算每个分类小节在滚动内容里的起始位置（所有区块高度固定，算得准）
  // 背景图+桌号条在最上面，也占滚动高度，所以分类位置从 base 开始算
  computeOffsets() {
    this.pxFactor = wx.getSystemInfoSync().windowWidth / 750;
    const base = (BG_H + BANNER_H) * this.pxFactor;
    this.baseTop = base;
    let acc = base;
    this.sectionOffsets = this.data.sections.map((sec) => {
      const top = acc;
      acc += (HEADER_H + sec.items.length * ROW_H) * this.pxFactor;
      return top;
    });
    // 左侧分类导航初始悬浮在桌号条下方（滚动时会跟着头部上滑贴顶）
    this.setData({ sideTop: Math.round(base) });
  },

  // ============ 滚动联动 ============
  // 点击左侧分类：右侧滚动到对应小节
  switchCategory(e) {
    const index = e.currentTarget.dataset.index;
    this.spyLock = true; // 滚动期间暂停自动高亮，防止打架
    this.setData({ activeIndex: index, scrollIntoId: '' });
    setTimeout(() => {
      this.setData({ scrollIntoId: 'sec-' + index });
    }, 30);
    setTimeout(() => {
      this.spyLock = false;
    }, 500);
  },

  // 右侧滚动时：自动高亮左侧分类 + 左侧导航跟着头部上滑贴顶
  onMenuScroll(e) {
    if (!this.sectionOffsets.length) return;
    const top = e.detail.scrollTop;

    // 左侧导航像"贴纸"一样跟着头部上滑：头部滚走多少，它就上滑多少；
    // 头部完全滚出屏幕后，它就贴在屏幕最上方，不会留下空白
    const sideTop = Math.max(0, this.baseTop - top);
    if (Math.abs(sideTop - this.data.sideTop) > 0.5) {
      this.setData({ sideTop: Math.round(sideTop) });
    }

    if (this.spyLock) return;
    let idx = 0;
    for (let i = 0; i < this.sectionOffsets.length; i++) {
      if (top >= this.sectionOffsets[i] - 10) idx = i;
      else break;
    }
    if (idx !== this.data.activeIndex) {
      this.setData({ activeIndex: idx });
    }
  },

  // ============ 加购 ============
  // 点击右侧商品的"+"号
  onAddTap(e) {
    const sec = this.data.sections[e.currentTarget.dataset.sec];
    const item = sec && sec.items[e.currentTarget.dataset.idx];
    if (!item) return;

    // 套餐：弹窗展示"套餐包含"清单，只选数量
    if (item._type === 2) {
      wx.showLoading({ title: '加载中' });
      request.get('/user/setmeal/dish/' + item.id).then((items) => {
        wx.hideLoading();
        this.setData({
          popupShow: true,
          popupTitle: item.name,
          popupPrice: item.price,
          popupPriceText: item.priceText,
          popupFlavors: [],
          popupDetailItems: items || [],
          popupTarget: { setmealId: item.id }
        });
      }).catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.message, icon: 'none' });
      });
      return;
    }

    // 菜品：有口味 -> 弹窗选口味和数量
    if (item.flavors && item.flavors.length) {
      this.setData({
        popupShow: true,
        popupTitle: item.name,
        popupPrice: item.price,
        popupPriceText: item.priceText,
        popupFlavors: item.flavors.map((f) => ({
          name: f.name,
          values: this.parseValues(f.value)
        })),
        popupDetailItems: [],
        popupTarget: { dishId: item.id }
      });
      return;
    }

    // 菜品：无口味 -> 直接加 1 份
    this.addToCart({ dishId: item.id }, 1);
  },

  // 口味值在后端是 JSON 字符串（如 '["不辣","微辣"]'），解析成数组
  parseValues(v) {
    if (!v) return [];
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  // 弹窗点"加入购物车"
  onPopupConfirm(e) {
    const { dishFlavor, quantity } = e.detail;
    const target = this.data.popupTarget;
    const body = target.setmealId ? { setmealId: target.setmealId } : { dishId: target.dishId };
    if (dishFlavor) {
      body.dishFlavor = dishFlavor;
    }
    this.setData({ popupShow: false });
    this.addToCart(body, quantity);
  },

  onPopupClose() {
    this.setData({ popupShow: false });
  },

  // 后端每次 add 只 +1，要 N 份就连续调 N 次（同一口味会自动合并成一行）
  async addToCart(body, quantity) {
    wx.showLoading({ title: '加入中' });
    try {
      for (let i = 0; i < quantity; i++) {
        await request.post('/user/shoppingCart/add', body);
      }
      wx.hideLoading();
      wx.showToast({ title: '已加入购物车', icon: 'none', duration: 800 });
      this.refreshCart();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  // 刷新购物车球：徽标=总件数，旁边显示合计金额
  refreshCart() {
    request.get('/user/shoppingCart/list').then((list) => {
      let count = 0;
      let cents = 0;
      (list || []).forEach((row) => {
        count += row.number;
        cents += util.toCents(row.amount) * row.number;
      });
      this.setData({ cartCount: count, cartAmountText: util.centsToMoney(cents) });
    }).catch(() => {});
  },

  // 去历史订单页
  goHistory() {
    wx.navigateTo({ url: '/pages/order/history' });
  },

  // 点购物车球 -> 下单确认页
  onCartTap() {
    if (!this.data.cartCount) {
      wx.showToast({ title: '购物车还是空的', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/confirm/index' });
  }
});
