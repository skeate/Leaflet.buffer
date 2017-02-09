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
    new webpack.NormalModuleReplacementPlugin(
      /node_modules\/jsts\/src\/java\/lang\/System\.js/,
      '../../../../../src/system-replacement.js'
    ),
    new webpack.optimize.CommonsChunkPlugin({
      filename: 'commons.js',
      name: 'commons',
    }),
  ],

  devtool: 'eval-source-map',

  devServer: {
    inline: true,
    contentBase: './example',
    port: 8111,
  },
};
