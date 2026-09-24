# 开放 API（Open API）

项目的 token 可以让脚本和 CI 在不登录的情况下调用 Yapix 的部分接口。在“项目 → 设置 → token 配置”中复制 token，然后在请求中加上 `token` 参数（查询参数或请求体字段）。

```bash
curl "https://yapix.example.com/api/interface/list_menu?token=<token>"
```

token 属于某一个用户和某一个项目：请求会以该用户的身份、在该项目的范围内执行，权限与该用户在项目中的角色相同。

> 从 YApi 升级：如果 YApi 的 `config.json` 没有设置 `passsalt`，YApi 生成的 token 使用了公开的默认密钥，任何人都能伪造。Yapix 默认拒绝这类 token，请在项目设置中获取新的 token。详见 [升级说明](../UPGRADING.md)。

## 接口列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/project/get` | 项目基本信息 |
| POST | `/api/project/up` | 更新项目 |
| GET | `/api/interface/getCatMenu` | 接口分类列表 |
| POST | `/api/interface/add_cat` | 新增接口分类（`name`, `desc`） |
| GET | `/api/interface/list_cat` | 某个分类下的接口列表（`catid`, `page`, `limit`） |
| GET | `/api/interface/list` | 接口列表（`page`, `limit`） |
| GET | `/api/interface/list_menu` | 接口菜单（分类及其接口） |
| GET | `/api/interface/get` | 接口详细定义（`id`） |
| POST | `/api/interface/add` | 新增接口 |
| POST | `/api/interface/up` | 更新接口（`id`） |
| POST | `/api/interface/save` | 新增或更新接口（按路径和方法匹配） |
| POST | `/api/open/import_data` | 导入数据，见下文 |
| GET | `/api/open/run_auto_test` | 运行测试集合，见下文 |
| GET | `/api/plugin/export` | 导出项目数据（`type`: `json`、`markdown`、`html`） |
| GET | `/api/plugin/exportSwagger` | 导出 Swagger 2.0（`type=OpenAPIV2`） |

`project_id` 由 token 决定，不需要传。

## 导入数据 `/api/open/import_data`

| 参数 | 说明 |
| --- | --- |
| `type` | 必填。数据格式，例如 `swagger` |
| `merge` | `normal`（默认，只新增）、`good`（智能合并）、`merge`（完全覆盖） |
| `json` | 数据内容（字符串）。与 `url` 二选一 |
| `url` | 由服务器下载数据的地址（http 或 https） |

```bash
curl -X POST https://yapix.example.com/api/open/import_data \
  -d type=swagger -d merge=good -d token=<token> \
  --data-urlencode json@swagger.json
```

## 运行测试集合 `/api/open/run_auto_test`

| 参数 | 说明 |
| --- | --- |
| `id` | 必填。测试集合 id |
| `mode` | `html`（默认）或 `json` |
| `email` | `true` 时把结果发邮件给项目成员 |
| `download` | `true` 时以文件下载 |
| `env_<项目id>` | 使用的环境名称，例如 `env_11=prod` |

测试请求由服务器发出。前置和后置脚本只有在 `config.json` 设置了 `"scriptEnable": true` 时才会执行，并在隔离环境中运行（没有网络访问和 Node.js API）。

---

# Open API (English)

A project token lets scripts and CI call part of the Yapix API without signing in. Copy the token from Project → Settings → Token, and add a `token` parameter (query string or body field) to the request. The request runs as the user who owns the token, inside that project, with that user's role. `project_id` comes from the token.

The endpoints and parameters are in the tables above. When upgrading from YApi without `passsalt` in `config.json`, tokens made by YApi used a public default key and could be forged, so Yapix refuses them by default: get a new token in the project settings (see [UPGRADING](../UPGRADING.md)).

Test runs from `/api/open/run_auto_test` are sent by the server. Pre- and post-request scripts run only when `config.json` sets `"scriptEnable": true`, and they run in an isolated environment without network access or Node.js APIs.
