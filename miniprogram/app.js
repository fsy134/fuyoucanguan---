// 小程序全局入口：解析扫码桌号 + 静默登录
const auth = require('./utils/auth.js');
const config = require('./config.js');

App({
  globalData: {
    tableNum: '',   // 当前桌号（扫码得到）
    peopleCount: 0  // 用餐人数（只在前端显示，不提交后端）
  },

  onLaunch(options) {
    // ✅ 0. 先初始化云能力（云调用的"总开关"，必须在任何云 API 之前调用）
    wx.cloud.init({
      env: config.cloudEnv, // 云托管环境 ID（写在 config.js）
      traceUser: true       // 顺手带上用户信息，便于云端日志排查
    });
    // 1. 解析桌号：扫码进入时，微信会把"小程序码"里藏着的 scene 参数带进来
    const tableNum = this.parseTableNum(options);
    if (tableNum) {
      this.globalData.tableNum = tableNum;
      wx.setStorageSync('TABLE_NUM', tableNum);
    }
    // 2. 静默登录：换一张"会员卡"（token）备用；失败不阻塞，
    //    之后发请求时 request.js 会自动重新登录
    auth.ensureLogin().catch(() => {});
  },

  // 从启动参数里提取桌号
  // 重要：options.scene 是微信的"启动场景编号"（如 1001=从发现栏打开），不是桌号！
  // 扫小程序码时，桌号藏在 options.query.scene 里（微信已自动解码）
  parseTableNum(options) {
    if (!options) return '';
    const query = options.query || {};
    if (query.scene) {
      return String(query.scene);
    }
    if (query.tableNum) {
      return String(query.tableNum);
    }
    return '';
  }
});
