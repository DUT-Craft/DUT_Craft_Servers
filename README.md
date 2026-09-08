# DUT_Craft_Servers

`DUT_Craft_Servers` 是一个用于展示 `DUT_Craft` Minecraft 服务器状态的静态页面。页面会读取预设服务器列表，并显示每个服务器的在线状态、人数、版本、MOTD 和地址信息。

## 功能简介

- 从 `public/servers.json` 读取服务器列表，适合直接通过仓库维护
- 支持刷新全部服务器，也支持单独刷新某一台服务器；页面每 60 秒自动同步一次
- 页头提供设备 / 在线 / 玩家汇总读数与值班时钟
- 展示在线、离线、错误三种状态，以及版本、在线人数、在线玩家列表和服务器图标
- 支持一个服务器配置多个地址，页面中可直接点击复制地址
- 「MC 游戏内 GUI」风格：真实客户端材质（暗化泥土背景、九宫格按钮、信号格图标）、俐方體11號中文像素字体，夜晚 / 白天双主题
- 展示字体与 GUI 材质全部自托管，无任何外部字体 / CDN 依赖（GUI 材质版权归 Mojang / Microsoft，仅作社区非商用展示）
- 当服务器列表更新后，页面重新刷新时会重新读取最新 JSON

## 本地使用

```bash
npm install
npm run dev
```

构建产物：

```bash
npm run build
```

## 配置服务器列表

服务器列表文件位于 [public/servers.json](/D:/DUT_Craft/Scripts/DUT_Craft_Servers/public/servers.json)。

推荐使用简写格式，`address` 直接写地址字符串（默认端口 25565 可省略），多个地址写成数组：

```json
[
  {
    "name": "DUT_Craft 大厅",
    "address": "lobby.unsafe.top"
  },
  {
    "name": "DUT_Craft 整合猫",
    "address": ["hz.utf-8.fun:25563", "mchk.unsafe.top:25563"]
  },
  {
    "name": "DUT_Craft 测试服",
    "address": ["test.unsafe.top", "test2.unsafe.top:25566"],
    "note": "测试用服务器，随时可能变动"
  }
]
```

字段说明：

- `name`：页面显示名称
- `address`：地址字符串（`host` 或 `host:port`）或地址数组，数组内字符串与对象可混用
- `note`：可选备注，显示在卡片标题下方，也可以当作配置里的注释使用

需要给地址单独设置 `id` 时，可以使用对象形式（与简写等价）：

```json
{
  "name": "DUT_Craft 测试服",
  "address": [
    { "host": "test.unsafe.top" },
    { "host": "test2.unsafe.top", "port": 25566 }
  ]
}
```

同时兼容旧版平铺格式（`host` / `port` 直接写在条目上）：

```json
[
  {
    "name": "DUT_Craft 大厅",
    "host": "lobby.unsafe.top",
    "port": 25565
  }
]
```

## 校验与错误提示

- [public/servers.schema.json](/D:/DUT_Craft/Scripts/DUT_Craft_Servers/public/servers.schema.json) 是列表格式的 JSON Schema，仓库内的 `.vscode/settings.json` 已将其关联到 `servers.json`，用 VS Code 打开即可获得格式校验与字段补全。
- 页面加载列表失败（文件不存在、JSON 语法错误、没有有效条目）时，会在页面顶部显示错误横幅并回退到内置示例列表，不会再静默显示。
- 列表中个别条目格式无效时会被忽略，并在横幅中提示忽略了多少条。

## 说明

- 页面数据通过 `https://api.mcsrvstat.us/2` 查询
- 接口结果有数分钟缓存，页面展示不一定是服务器的瞬时状态；页脚与"上次同步"时间可作参考
