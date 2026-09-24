// Client build: webpack 5 + Babel 7. Replaces YApi's ykit (webpack 1) build.
//   npm run build-client          production build into static/prd and static/index.html
//   npm run dev-client            development build, rebuilt on change
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const pkg = require('./package.json');

require('./scripts/gen-plugin-module')();

const root = (...p) => path.resolve(__dirname, ...p);

module.exports = (env, argv) => {
  const prod = argv.mode !== 'development';
  const name = prod ? '[name].[contenthash:8]' : '[name]';
  return {
    mode: prod ? 'production' : 'development',
    context: root('client'),
    entry: { index: './index.js' },
    output: {
      path: root('static/prd'),
      publicPath: '/prd/',
      filename: `${name}.js`,
      chunkFilename: `${name}.js`,
      assetModuleFilename: '[name].[contenthash:8][ext]',
      clean: true
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        client: root('client'),
        common: root('common'),
        exts: root('exts')
      },
      // Shared code in common/ also runs on the server; give the browser build what it needs.
      fallback: {
        url: require.resolve('url/'),
        buffer: require.resolve('buffer/'),
        https: false,
        http: false,
        crypto: false,
        fs: false,
        path: false,
        os: false,
        vm: false,
        assert: false
      }
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: [/tui-editor/, /node_modules[\\/](?!json-schema-editor-visual|yapi-plugin-)/],
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              // Much of the YApi code mixes import with module.exports, which only works as CommonJS.
              sourceType: 'unambiguous',
              presets: [['@babel/preset-env', { modules: 'commonjs' }], '@babel/preset-react'],
              plugins: [
                ['@babel/plugin-proposal-decorators', { legacy: true }],
                ['@babel/plugin-transform-class-properties', { loose: true }],
                ['import', { libraryName: 'antd' }]
              ]
            }
          }
        },
        {
          test: /\.less$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            { loader: 'less-loader', options: { lessOptions: { javascriptEnabled: true, math: 'always' } } }
          ]
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            { loader: 'sass-loader', options: { sassOptions: { silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'slash-div'] } } }
          ]
        },
        { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
        {
          test: /\.(gif|jpe?g|png|svg|woff2?|eot|ttf)$/,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 8192 } }
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
        'process.env.version': JSON.stringify(pkg.version),
        'process.env.versionNotify': 'false'
      }),
      new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'], process: 'process/browser.js' }),
      // common/postmanLib.js loads server modules only when it runs on the server.
      new webpack.IgnorePlugin({ resourceRegExp: /^\.\.\/server\//, contextRegExp: /common$/ }),
      new webpack.ContextReplacementPlugin(/moment[\\/]locale$/, /^\.\/(zh-cn|en-gb)$/),
      new MiniCssExtractPlugin({ filename: `${name}.css` }),
      new HtmlWebpackPlugin({ template: root('client/index.html'), filename: root('static/index.html') }),
      prod && new CompressionPlugin({ test: /\.(js|css)$/, threshold: 10240, minRatio: 0.8 })
    ].filter(Boolean),
    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        cacheGroups: { vendors: { test: /[\\/]node_modules[\\/]/, name: 'vendors', priority: -10 } }
      }
    },
    devtool: prod ? false : 'eval-cheap-module-source-map',
    performance: { hints: false },
    stats: 'errors-warnings'
  };
};
