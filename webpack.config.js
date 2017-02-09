const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    example: './example/index.js',
    'leaflet.buffer': './src/leaflet.buffer.js',
  },

  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
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
          'file-loader?hash=sha512&digest=hex^name=[hash].[ext]',
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

  plugins: [
    new webpack.SourceMapDevToolPlugin({}),
    new webpack.optimize.CommonsChunkPlugin({
      filename: 'commons.js',
      name: 'commons',
    }),
  ],

  devServer: {
    inline: true,
    contentBase: './example',
    port: 8111,
  },
};
