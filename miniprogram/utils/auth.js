// ============================================
// 登录相关：微信静默登录 + token 存取
// token 相当于微信帮顾客发的"会员卡"，
// 存在手机本地，每次请求自动带上
// ============================================
const config = require('../config.js');

// 取本地存的 token
function getToken() {
  return wx.getStorageSync('TOKEN') || '';
}

function setToken(token) {
  wx.setStorageSync('TOKEN', token);
}

function clearToken() {
  wx.removeStorageSync('TOKEN');
}

// 正在进行的登录请求（多个地方同时需要登录时只登录一次）
let loginPromise = null;

// 静默登录：wx.login 拿 code -> 后端换成 token
function ensureLogin() {
  if (!loginPromise) {
    loginPromise = doLogin().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

function doLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('微信登录失败'));
          return;
        }
        // ✅ 与 request.js 一样走"云调用"通道（免合法域名）
        wx.cloud.callContainer({
          config: { env: config.cloudEnv },
          path: '/user/user/login',
          method: 'POST',
          data: { code: res.code },
          header: {
            'content-type': 'application/json',
            'X-WX-SERVICE': config.cloudService // 指定交给哪个服务
          },
          success: (r) => {
            if (r.statusCode === 200 && r.data && r.data.code === 1 &&
                r.data.data && r.data.data.token) {
              setToken(r.data.data.token);
              resolve(r.data.data.token);
            } else {
              reject(new Error('登录失败，请检查小程序 appid 与后端配置是否一致'));
            }
          },
          fail: () => reject(new Error('登录失败，请检查网络和后端是否启动'))
        });
      },
      fail: () => reject(new Error('微信登录失败'))
    });
  });
}

module.exports = { getToken, setToken, clearToken, ensureLogin };
