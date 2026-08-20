// ============================================
// 购物车球：右下角悬浮球
// 小红标显示购物车总件数，旁边显示合计金额
// ============================================
Component({
  properties: {
    // 总件数
    count: { type: Number, value: 0 },
    // 合计金额显示文本，如 "66.50"
    amountText: { type: String, value: '0.00' }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});
