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
      { test: /\.js$/, loader: 'babel-loader' },
    ],
  },

  plugins: [
    new webpack.optimize.UglifyJsPlugin(),
  ],
};
