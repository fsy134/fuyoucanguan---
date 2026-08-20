// ============================================
// 网络请求封装：所有页面都通过它和后端说话
// 职责：自动拼地址、自动带"会员卡"token、
//       登录过期自动重新登录并重试一次、统一错误提示
// ✅ 2026-08-20 改为"云调用"（wx.cloud.callContainer）：
//    走微信官方的内部专用通道访问云托管，
//    不需要配合法域名（体验版/正式版都可用），
//    且微信会自动带上用户身份，比直连更安全
// ============================================
const config = require('../config.js');
const auth = require('./auth.js');

function request(options) {
  return new Promise((resolve, reject) => {
    // needRetry=true 表示这次请求遇到 401 还有一次"重新登录再试"的机会
    const doRequest = (needRetry) => {
      const token = auth.getToken();
      const header = { 'content-type': 'application/json' };
      if (token) {
        header.authentication = token; // 后端约定的 token 请求头名
      }
      // ✅ X-WX-SERVICE 告诉云网关"这个请求交给哪个服务"
      header['X-WX-SERVICE'] = config.cloudService;
      wx.cloud.callContainer({
        config: { env: config.cloudEnv }, // 用哪个云托管环境（环境 ID 写在 config.js）
        path: options.url,                // 云调用只填路径，不带域名
        method: options.method || 'GET',
        data: options.data || {},
        header: header,
        timeout: 10000,
        success: (res) => {
          // callContainer 的 res 和 wx.request 形状一致：statusCode + data
          // 后端登录失效时返回的是"没有内容的 401"，必须按状态码处理
          if (res.statusCode === 401) {
            if (needRetry) {
              auth.clearToken();
              auth.ensureLogin()
                .then(() => doRequest(false)) // 重新登录成功后重发原请求
                .catch((err) => reject(err));
            } else {
              reject(new Error('登录状态异常，请重试'));
            }
            return;
          }
          if (res.statusCode !== 200 || !res.data) {
            reject(new Error('服务器开小差了，请稍后再试'));
            return;
          }
          // 后端约定：code=1 才是成功（callContainer 已自动把 JSON 解析成对象）
          if (res.data.code !== 1) {
            reject(new Error(res.data.msg || '操作失败'));
            return;
          }
          resolve(res.data.data);
        },
        fail: () => reject(new Error('网络异常，请检查网络连接'))
      });
    };
    doRequest(true);
  });
}

module.exports = {
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  del: (url, data) => request({ url, method: 'DELETE', data })
};
