const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = [
  // Main thread (plugin code)
  {
    entry: './src/code.ts',
    output: { filename: 'code.js', path: path.resolve(__dirname, 'dist') },
    resolve: { extensions: ['.ts', '.js'] },
    module: { rules: [{ test: /\.ts$/, use: 'ts-loader' }] },
    target: 'web',
  },
  // UI iframe
  {
    entry: './src/ui/index.tsx',
    output: { filename: 'ui.js', path: path.resolve(__dirname, 'dist') },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        { test: /\.tsx?$/, use: 'ts-loader' },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/ui/ui.html',
        filename: 'ui.html',
        inject: 'body',
        inlineSource: '.(js|css)$',
      }),
    ],
  },
]
