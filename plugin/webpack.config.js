const path = require('path')

module.exports = {
  entry: './src/code.ts',
  output: {
    filename: 'code.js',
    path: path.resolve(__dirname, 'dist'),
    environment: { dynamicImport: false, module: false },
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: { rules: [{ test: /\.ts$/, use: 'ts-loader' }] },
  target: 'web',
}
