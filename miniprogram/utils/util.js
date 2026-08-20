// ============================================
// 通用小工具函数
// ============================================

// 金额显示：66.5 -> "66.50"
function formatMoney(val) {
  return Number(val || 0).toFixed(2);
}

// 金额转"分"（避免小数相加产生误差）：66.5 -> 6650
function toCents(val) {
  return Math.round(Number(val || 0) * 100);
}

// 把"分"还原成显示金额：6650 -> "66.50"
function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

module.exports = { formatMoney, toCents, centsToMoney };
