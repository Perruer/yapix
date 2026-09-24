import React from 'react';
import { Alert } from 'antd';
import PropTypes from 'prop-types';

exports.initCrossRequest = function (fn) {
  let startTime = 0;
  let _crossRequest = setInterval(() => {
    startTime += 500;
    if (startTime > 5000) {
      clearInterval(_crossRequest);
    }
    if (window.crossRequest) {
      clearInterval(_crossRequest);
      fn(true);
    } else {
      fn(false);
    }
  }, 500);
  return _crossRequest;
};

CheckCrossInstall.propTypes = {
  hasPlugin: PropTypes.bool
};

function CheckCrossInstall(props) {
  const hasPlugin = props.hasPlugin;
  return (
    <div className={hasPlugin ? null : 'has-plugin'}>
      {hasPlugin ? (
        ''
      ) : (
        <Alert
          message={
            <div>
              重要：在浏览器中测试接口需要安装免费扩展 Yapix Request Helper（Chrome、Edge 等 Chromium 浏览器）。
              <div>
                <a href="/api/interface/download_crx">[下载扩展]</a>
                &nbsp;解压后打开 chrome://extensions，开启“开发者模式”，点击“加载已解压的扩展程序”，
                然后点击扩展图标，允许当前站点。&nbsp;
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://github.com/Perruer/yapix/blob/main/docs/documents/extension.md"
                >
                  [安装说明]
                </a>
              </div>
            </div>
          }
          type="warning"
        />
      )}
    </div>
  );
}

export default CheckCrossInstall;
