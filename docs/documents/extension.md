# Yapix Request Helper 浏览器扩展

在浏览器中“运行”接口、执行测试集合时，请求要发往与 Yapix 不同的域名，浏览器的跨域限制（CORS）会拦截这些请求。Yapix Request Helper 扩展替页面发送请求并把结果交回页面。它取代了 YApi 使用的 cross-request 扩展（Manifest V2，已无法在新版 Chrome 中使用）。

## 安装

1. 在 Yapix 的接口“运行”页点击 **[下载扩展]**，或直接打开 `https://你的-yapix-地址/api/interface/download_crx`，得到 `yapix-request-helper.zip`。
2. 解压 zip。
3. 在 Chrome 或 Edge 中打开 `chrome://extensions`（Edge：`edge://extensions`），打开右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择解压出来的 `yapix-request-helper` 文件夹。
5. 打开你的 Yapix 站点，点击工具栏中的扩展图标，点击 **Allow this site**。页面会自动刷新。

## 安全说明

- 扩展只在你允许的站点上工作。在其他网站上它不会向页面注入任何代码。
- 被允许的站点可以带着你的 Cookie 向任何地址发送请求并读取响应。只允许你信任的 Yapix 站点。
- 在扩展弹窗中可以随时取消允许。
- 浏览器禁止脚本设置的请求头（如 `Cookie`、`Host`、`Origin`、`Referer`）不会被发送。

## 与 YApi 的兼容

扩展提供与 cross-request 相同的 `window.crossRequest(options)` 接口，旧版 YApi 页面也可以使用。

---

# Yapix Request Helper (English)

When you run an interface or a test collection in the browser, the requests go to other origins and CORS blocks them. The Yapix Request Helper extension sends them for the page and hands the results back. It replaces the cross-request extension that YApi used (Manifest V2, which current Chrome no longer runs).

## Install

1. On an interface's Run tab click **[下载扩展]** (download), or open `https://<your-yapix>/api/interface/download_crx`, to get `yapix-request-helper.zip`.
2. Unzip it.
3. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped `yapix-request-helper` folder.
5. Open your Yapix site, click the extension icon and click **Allow this site**. The page reloads.

## Security

- The extension works only on sites you allow; it adds nothing to other pages.
- An allowed site can send requests with your cookies to any address and read the responses. Allow only Yapix sites you trust.
- You can stop allowing a site in the popup at any time.
- Headers that browsers do not let scripts set (`Cookie`, `Host`, `Origin`, `Referer` and others) are not sent.

## Compatibility

The extension provides the same `window.crossRequest(options)` function as cross-request, so YApi pages work with it too.
