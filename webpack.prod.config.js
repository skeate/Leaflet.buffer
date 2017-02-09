/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    'leaflet-buffer': './src/leaflet.buffer.js',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'leaflet.buffer.min.js',
  },

  module: {
    loaders: [
      {
        test: /\.js$/i,
        loader: 'babel-loader',
        exclude: /node_modules\/(^jsts)/,
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
          'url-loader?hash=sha512&digest=hex^name=[hash].[ext]',
        ],
      },
      {
        test: /\.css$/i,
        loaders: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },

  devtool: 'cheap-module-source-map',

  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /node_modules\/jsts\/src\/java\/lang\/System\.js/,
      '../../../../../src/system-replacement.js'
    ),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
};
