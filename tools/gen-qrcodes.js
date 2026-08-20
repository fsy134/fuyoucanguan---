// ============================================
// 桌码生成工具：为 1~N 号桌生成微信"小程序码"
// 每张码里藏着桌号（scene 参数），顾客扫码后小程序自动认出桌号
//
// 用法：
//   node tools/gen-qrcodes.js [桌数] [版本]
//   版本：trial=体验版(默认) develop=开发版 release=正式版
// 示例：
//   node tools/gen-qrcodes.js 20 trial
//
// 生成的图片放在项目根目录的 桌码/ 文件夹里（不要放进 miniprogram/，
// 否则会撑大小程序包），打印出来按桌号贴桌即可
// ============================================
const fs = require('fs');
const path = require('path');

// 后端配置文件路径（从中读取小程序的 appid 和 secret，保持只存一处）
const YML_PATH = 'C:/Users/15122/Desktop/文件资料/java/sky-take-out/sky-server/src/main/resources/application-dev.yml';

// 输出目录
const OUT_DIR = path.join(__dirname, '..', '桌码');

// 从后端配置文件里读 appid 和 secret
function readWxConfig() {
  const text = fs.readFileSync(YML_PATH, 'utf-8');
  const appid = (text.match(/appid:\s*(\S+)/) || [])[1] || '';
  const secret = (text.match(/secret:\s*(\S+)/) || [])[1] || '';
  if (!appid || !secret) {
    throw new Error('没从后端配置里读到 appid/secret，请检查 application-dev.yml');
  }
  return { appid, secret };
}

// 第一步：拿 access_token（一张 2 小时内有效的"通行证"）
async function getAccessToken(appid, secret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('获取 access_token 失败：' + JSON.stringify(data));
  }
  return data.access_token;
}

// 第二步：生成一张桌码（微信直接返回图片二进制）
async function genCode(token, scene, page, envVersion, width) {
  const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene: scene,          // 桌号，如 "3"
      page: page,            // 扫码后打开的小程序页面
      check_path: false,     // 不校验页面是否已发布（未发布也能生成）
      env_version: envVersion, // 打开哪个版本：trial体验版 develop开发版 release正式版
      width: 430             // 图片宽度（像素）
    })
  });
  const buf = Buffer.from(await res.arrayBuffer());
  // 微信失败时返回的是 JSON 错误文本（以 { 开头），成功时是图片二进制
  if (buf[0] === 0x7b) {
    throw new Error('生成失败：' + buf.toString('utf-8'));
  }
  return buf;
}

(async () => {
  const tableCount = Number(process.argv[2]) || 20;
  const envVersion = process.argv[3] || 'trial';
  const { appid, secret } = readWxConfig();
  console.log('appid:', appid, '| 桌数:', tableCount, '| 版本:', envVersion);

  const token = await getAccessToken(appid, secret);
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  for (let i = 1; i <= tableCount; i++) {
    const buf = await genCode(token, String(i), 'pages/menu/index', envVersion, 430);
    const file = path.join(OUT_DIR, 'table_' + i + '.png');
    fs.writeFileSync(file, buf);
    console.log('已生成 ' + i + ' 号桌：' + file);
  }
  console.log('全部完成！把"桌码"文件夹里的图片打印出来，按桌号贴桌即可');
})().catch((err) => {
  console.error('出错了：', err.message);
  process.exit(1);
});
