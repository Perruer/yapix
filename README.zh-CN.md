<p align="center"><img src="images/yapix_mark.svg" width="96" alt="Yapix"></p>

<h1 align="center">Yapix</h1>

<p align="center">
  <b>面向团队的接口文档、Mock 服务与接口测试平台。YApi 的持续维护版，专注安全修复。</b>
</p>

<p align="center">
  <a href="https://github.com/Perruer/yapix/actions/workflows/ci.yml"><img src="https://github.com/Perruer/yapix/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Perruer/yapix/releases"><img src="https://img.shields.io/github/v/release/Perruer/yapix" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
</p>

<p align="center"><a href="README.md">English</a> · 简体中文 · <a href="README.ru.md">Русский</a></p>

---

YMFE 的 [YApi](https://github.com/YMFE/yapi) 是使用最广泛的私有化部署接口管理平台之一（27.7k Star），最后一个版本发布于 2022 年 11 月。此后它无法在新版 Node.js 上运行，前端无法重新构建，依赖的浏览器扩展在 Chrome 中已不可用，已知漏洞（包括通过 Mock 脚本执行任意代码）也一直没有修复。

Yapix 基于 YApi 1.12，让它可以继续安全地运行。现有的 YApi 数据库可以直接使用：用户、项目、接口、测试集合和 Mock 数据都会保留。

## 与 YApi 1.12 的区别

| | YApi 1.12 | Yapix 2.0 |
| --- | --- | --- |
| Node.js | 最高 20；在 22 及以上版本 token 无法使用 | 24 LTS |
| 数据库层 | Mongoose 5.7（2019 年） | Mongoose 9；MongoDB 4.4–8 |
| Mock 与测试脚本 | `vm2`/`safeify` 和 `node:vm`，无法把脚本与服务器隔离 | 每次运行使用独立的 V8 隔离环境，限制内存和时间，无法访问 Node.js |
| 项目 token | 未设置 `passsalt` 时使用公开密钥 `abcde` 加密：项目成员可以伪造其他用户的 token | 随机密钥保存在数据库中；默认拒绝 YApi 生成的可伪造 token（可临时开启兼容模式） |
| 初始管理员 | 密码 `ymfe.org` | `YAPIX_ADMIN_PASSWORD` 或随机密码 |
| 密码存储 | 加盐 SHA-1 | scrypt，旧哈希在登录时自动替换 |
| 生产依赖中的已知漏洞 | 244 个（50 个严重） | 1 个，已缓解（Mock.js，无修复版本） |
| 前端构建 | ykit（webpack 1）和 node-sass：已无法构建 | webpack 5、Babel 7、dart-sass |
| “运行”页所需的浏览器扩展 | cross-request（Manifest V2，新版 Chrome 已不可用，无许可证） | Yapix Request Helper（Manifest V3，Apache-2.0），只在你允许的站点上工作 |
| 服务端测试请求 | 不校验 TLS 证书（CVE-2025-70058） | 校验，测试环境可关闭 |
| Docker | 社区镜像 | 官方镜像，支持 amd64 和 arm64 |
| 升级检查 | — | 每次变更时 CI 用 YApi 1.12 生成数据库，再用 Yapix 检查 |

完整列表见 [SECURITY.md](SECURITY.md) 和 [更新日志](CHANGELOG.md)。其他功能与 YApi 1.12 相同：接口与分类、JSON Schema、Mock.js 数据与高级 Mock、测试集合与报告、Swagger/Postman/HAR 导入、导出、开放 API、Wiki、插件和 LDAP。

## 快速开始

### Docker

```bash
curl -O https://raw.githubusercontent.com/Perruer/yapix/main/docker-compose.yml
YAPIX_ADMIN_PASSWORD='一个足够长的密码' docker compose up -d
```

打开 http://localhost:3000，使用 `admin@admin.com` 登录。配置说明见 [docs/devops/docker.md](docs/devops/docker.md)。

### 源码部署

需要 Node.js 24 和 MongoDB 4.4 或更高版本。

```bash
mkdir yapix && cd yapix
git clone https://github.com/Perruer/yapix.git vendors
cp vendors/config_example.json config.json      # 修改 db、adminAccount 等配置
cd vendors
npm ci
npm run build-client
YAPIX_ADMIN_PASSWORD='一个足够长的密码' npm run install-server
npm start
```

与 YApi 一样，`config.json` 放在 `vendors` 目录旁边；也可以用 `YAPIX_CONFIG=/path/to/config.json` 指定其他位置。

### 浏览器扩展

在“运行”页发送请求、在浏览器中运行测试集合，需要安装 **Yapix Request Helper**（Chrome、Edge 等 Chromium 浏览器）：在“运行”页或 [Releases](https://github.com/Perruer/yapix/releases) 下载，以“加载已解压的扩展程序”方式安装，然后在扩展弹窗中允许你的 Yapix 站点。详见 [docs/documents/extension.md](docs/documents/extension.md)。

## 从 YApi 升级

备份 MongoDB，停止 YApi，然后在同一个数据库上启动 Yapix。请先阅读 [UPGRADING.md](UPGRADING.md)（英文）：其中说明了 MongoDB 版本要求、需要更换的项目 token、脚本限制和新扩展。

## 文档

- [使用手册](docs/documents/index.md)（来自 YApi）
- [开放 API](docs/documents/openapi.md)
- [Docker](docs/devops/docker.md)
- [插件开发](docs/documents/plugin-dev.md)

## 开发

```bash
npm ci
npm test                 # 单元测试
npm run dev-client       # 修改后自动重新构建前端
npm run dev-server       # 修改后自动重启服务
```

端到端测试（`test/e2e/`）针对运行中的服务执行：接口流程、从 YApi 1.12 数据库升级、浏览器扩展。运行方法见 CI 配置。

## 支持项目

Yapix 由我在业余时间维护。如果它帮助你的团队管理和测试接口，欢迎支持：

- [Boosty](https://boosty.to/mikio_kuroki/donate)
- USDT / TRX（TRC-20）：`TXUBW4e88SDTfrnJRKfbhYfFcggufbonc1`
- USDT / USDC / ETH（ERC-20）：`0x1378491169064702786b2E5b58c6375776177E8A`
- TON / USDT（TON）：`UQAhI7EKzoa-JuKOfv0ULMzA3FrmpxsDkXj8Qevwj2z1cMRN`

## 许可证

与 YApi 相同，使用 [Apache-2.0](LICENSE)。Yapix 是 YMFE（去哪儿网）[YApi](https://github.com/YMFE/yapi) 的延续，见 [NOTICE](NOTICE)。YApi 原始 README 保存在 [docs/upstream-README.md](docs/upstream-README.md)。Yapix 与 YMFE 及去哪儿网无关联，也未获得其认可。
