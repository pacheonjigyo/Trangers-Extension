const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

var options = {
    mode: process.env.NODE_ENV || 'development',

    entry: {
        app: "./main/app.js",
        login: "./main/login.js",
        payment: "./main/payment.js",
        background: "./background.js",
        common: "./common.js",
        popup: "./popup.js",
        content: "./content/index.js"
    },

    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'build'),
    },

    resolve: {
        fallback: {
            "buffer": require.resolve("buffer"),
        },
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'main', 'app.html'),
            filename: 'app.html',
            chunks: ['app'],
            cache: false,
        }),

        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'main', 'login.html'),
            filename: 'login.html',
            chunks: ['login'],
            cache: false,
        }),

        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'main', 'payment.html'),
            filename: 'payment.html',
            chunks: ['payment'],
            cache: false,
        }),

        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'popup.html'),
            filename: 'popup.html',
            chunks: ['popup'],
            cache: false,
        }),

        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'icon16.png',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'icon48.png',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'icon128.png',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: './main/common.css',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: './style.css',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'fonts/**',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'icons/**',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'resources/**',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: 'ui/**',
                    to: path.join(__dirname, 'build'),
                    force: true,
                },

                {
                    from: './manifest.json',
                    to: path.join(__dirname, 'build'),
                    force: true,

                    transform: function (content, path) {
                        return Buffer.from(
                            JSON.stringify({
                                description: process.env.npm_package_description,
                                version: process.env.npm_package_version,
                                ...JSON.parse(content.toString()),
                            })
                        );
                    },
                },
            ],
        }),
    ],

    devtool: "inline-source-map"
};

module.exports = options;