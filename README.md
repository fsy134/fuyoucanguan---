# 富有餐馆 · 微信扫码点餐小程序

堂食扫码点餐小程序：每桌一张专属小程序码，顾客扫码 → 选人数 → 点餐 → 下单 → 催单/付款，商家后台实时收到提醒。

## 项目结构

```
fuyoucanguan/
├── project.config.json      # 微信开发者工具项目配置（含调试编译模式）
└── miniprogram/             # 小程序代码
    ├── app.js               # 全局入口：解析扫码桌号 + 静默登录
    ├── config.js            # 全局配置：店铺信息、后端地址、桌数
    ├── utils/               # request.js 网络封装 / auth.js 登录 / util.js 工具
    ├── components/          # add-popup 口味弹窗 / cart-ball 购物车球
    └── pages/
        ├── table/           # 选桌页（没扫码打开时的兜底入口）
        ├── menu/            # 点餐页（核心）
        ├── confirm/         # 下单确认页
        ├── order/detail/    # 订单详情页（催单/付款/取消）
        ├── order/history/   # 历史订单页（再来一单）
        └── closed/          # 打烊提示页
```

## 怎么运行

1. 微信开发者工具导入本目录（AppID 与后端配置保持一致，如 wx888098f8a35aaab4）
2. 启动后端（Spring Boot，8080 端口），确保 MySQL、Redis 已启动
3. 后端地址在 `miniprogram/config.js` 的 `baseUrl` 里改：
   - 开发者工具里调试：`http://localhost:8080`
   - 手机真机联调：改成电脑局域网 IP（如 `http://192.168.1.100:8080`），并在开发者工具里勾选"不校验合法域名"
   - 上线：改成 HTTPS 域名并在小程序后台配置合法域名
4. 调试桌号：开发者工具 → 编译模式 → 选"模拟3号桌(编译模式)"

## 常用调整

- 店铺名称/简介/营业时间/背景图/头像：改 `miniprogram/config.js`
- 招牌菜分类：商家后台新建名为 `招牌菜` 的菜品分类即可自动置顶（名称可改 config.js 的 `featuredCategoryName`）
- 可多选口味（如"葱蒜"可同时勾"不要葱"+"不要蒜"）：把口味维度名加进 config.js 的 `multiFlavorNames` 名单；这类口味的选项名里不要出现 `+` 号
- 商家后台把营业状态设为"营业中"，否则小程序会显示打烊页

## 生成桌码

每张桌贴一张专属小程序码（码里藏着桌号）：

```
node tools/gen-qrcodes.js 20 trial
```

- 第 1 个参数是桌数，第 2 个参数是打开哪个版本（trial体验版 / develop开发版 / release正式版）
- 图片生成在项目根目录的 `桌码/` 文件夹里，打印后按桌号贴桌
- 注意：appid 必须是**自己注册的小程序账号**（当前演示 appid 生成的码扫码会打开微信官方演示程序）；appid/secret 与后端 application-dev.yml 保持一致
