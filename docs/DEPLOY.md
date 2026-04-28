# 晓园 Vault 部署文档

> 版本：v1.0
> 更新：2026-04-27

---

## 一、开发环境

### 1.1 环境要求

| 要求 | 版本 |
|------|------|
| Node.js | ≥ 20.x |
| npm | ≥ 10.x |
| Python | ≥ 3.10（可选，用于 tesseract）|
| Xcode | ≥ 15（macOS 开发）|

### 1.2 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-repo/xiaoyuan-vault.git
cd xiaoyuan-vault

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 QWEN_API_KEY
```

### 1.3 .env 配置

```bash
# 必填
QWEN_API_KEY=your_qwen_api_key

# 可选
QWEN_MODEL=qwen3.5-flash
NODE_ENV=development
```

### 1.4 开发启动

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 打包安装包
npm run package
```

---

## 二、生产构建

### 2.1 构建流程

```bash
npm run build        # electron-vite build
npm run package      # electron-builder
```

### 2.2 构建产物

| 平台 | 文件 | 位置 |
|------|------|------|
| macOS | `.dmg` | `release/` |
| Windows | `.exe` (NSIS) | `release/` |
| Linux | `.AppImage` | `release/` |

### 2.3 electron-builder 配置

```json
// electron-builder.json
{
  "appId": "com.xiaoyuan.vault",
  "productName": "晓园 Vault",
  "directories": {
    "output": "release"
  },
  "mac": {
    "category": "public.app-category.productivity",
    "target": ["dmg"]
  },
  "win": {
    "target": ["nsis"]
  },
  "linux": {
    "target": ["AppImage"]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

---

## 三、安装与运行

### 3.1 macOS

**方式一：DMG 安装**
1. 双击 `.dmg` 文件
2. 拖动「晓园 Vault」到 Applications
3. 首次运行需要在「系统偏好设置 → 安全性与隐私」允许运行

**方式二：命令行安装**
```bash
hdiutil mount release/xiaoyuan-vault-*.dmg
cp -R "/Volumes/晓园 Vault/晓园 Vault.app" /Applications
hdiutil unmount /Volumes/晓园 Vault
```

### 3.2 Windows

1. 双击 `.exe` 安装包
2. 选择安装目录（默认 `C:\Program Files\晓园 Vault`）
3. 创建桌面快捷方式
4. 完成安装

### 3.3 Linux

```bash
# 给 AppImage 执行权限
chmod +x release/xiaoyuan-vault-*.AppImage

# 运行
./release/xiaoyuan-vault-*.AppImage
```

---

## 四、数据存储

### 4.1 数据目录

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/xiaoyuan-vault/` |
| Windows | `%APPDATA%/xiaoyuan-vault/` |
| Linux | `~/.config/xiaoyuan-vault/` |

### 4.2 Vault 结构

```
your-vault/
├── 0-收集/
├── 1-人物/
├── .raw/
├── .xiaoyuan/
│   └── index.db       # SQLite 索引
├── RESOLVER.md
├── schema.md
├── index.md
└── log.md
```

### 4.3 备份

**手动备份**：
- 直接复制整个 Vault 文件夹

**自动备份建议**：
- 使用 Syncthing / 坚果云 / iCloud 同步 Vault 文件夹
- `.xiaoyuan/index.db` 会被自动同步

---

## 五、卸载

### 5.1 macOS

```bash
# 删除应用
rm -rf /Applications/晓园\ Vault.app

# 清理配置（可选）
rm -rf ~/Library/Application\ Support/xiaoyuan-vault/
rm -rf ~/Library/Saved\ Application\ State/com.xiaoyuan.vault.savedState/
```

### 5.2 Windows

1. 打开「设置 → 应用」
2. 找到「晓园 Vault」
3. 点击「卸载」

### 5.3 Linux

```bash
rm -rf ~/.local/share/xiaoyuan-vault/
rm -f ~/.config/xiaoyuan-vault/
```

---

## 六、常见问题

### 6.1 启动报错

**Q**: 应用启动后白屏/崩溃

**A**:
```bash
# 清理缓存
rm -rf ~/Library/Caches/xiaoyuan-vault/
rm -rf ~/Library/Application\ Support/xiaoyuan-vault/node_modules/.cache/
```

### 6.2 AI 功能不可用

**Q**: 提示"请配置 QWEN_API_KEY"

**A**:
1. 打开设置
2. 在 `.env` 文件中添加 `QWEN_API_KEY`
3. 重启应用

### 6.3 文件索引损坏

**Q**: 搜索无结果或报错

**A**:
```bash
# 删除索引文件，应用会自动重建
rm ~/Library/Application\ Support/xiaoyuan-vault/config.json
# 或删除 Vault 内的 .xiaoyuan/index.db
```

### 6.4 macOS 无法打开

**Q**: "晓园 Vault" 无法打开，因为无法验证开发者

**A**:
1. 系统偏好设置 → 安全性与隐私 → 通用
2. 点击「仍要打开」

---

## 七、更新

### 7.1 自动更新（TODO）

当前版本需要手动更新：
1. 下载新版本 `.dmg` / `.exe`
2. 安装覆盖

### 7.2 数据迁移

新版本通常兼容旧数据，但建议更新前：
1. 备份 Vault 文件夹
2. 备份 `.xiaoyuan/` 目录

---

## 八、环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `QWEN_API_KEY` | ✅ | - | 通义千问 API Key |
| `QWEN_MODEL` | ❌ | qwen3.5-flash | 模型名称 |
| `NODE_ENV` | ❌ | production | 运行环境 |

### 8.1 获取 QWEN_API_KEY

1. 访问[阿里云百炼](https://bailian.console.aliyun.com/)
2. 创建应用或获取 API Key
3. 在控制台充值（按量付费）

---

## 九、日志

### 9.1 日志位置

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Logs/xiaoyuan-vault/` |
| Windows | `%APPDATA%/xiaoyuan-vault/logs/` |
| Linux | `~/.config/xiaoyuan-vault/logs/` |

### 9.2 日志级别

默认 `info`，可在代码中调整：
```typescript
log.transports.file.level = 'debug'
```

---

## 十、团队部署

### 10.1 建议的团队配置

1. **Vault 存储**：使用共享文件夹（NAS / iCloud / Syncthing）
2. **编辑流程**：一人编辑 → Git 提交 → 其他人拉取
3. **冲突处理**：保留两份，用 `[[文件名-冲突副本]]` 标记

### 10.2 Syncthing 配置示例

```yaml
# Syncthing 设备配置
<device id="XXX">
  <name>团队成员A</name>
  <addresses>
    <address>dynamic</address>
  </addresses>
</device>

<folder id="vault">
  <path>/Users/name/Vault</path>
  <device ref="XXX"/>
  <type>sendonly</type>  <!-- 多人编辑用 sendonly -->
</folder>
```

### 10.3 Git 协同（Phase 3）

详见 Phase 3 规划。
