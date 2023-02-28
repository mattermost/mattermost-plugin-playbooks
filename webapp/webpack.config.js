/* eslint-disable no-console, no-process-env */

const exec = require('child_process').exec;

const path = require('path');

const webpack = require('webpack');
const {ModuleFederationPlugin} = require('webpack').container;

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const PLUGIN_ID = require('../plugin.json').id;

const NPM_TARGET = process.env.npm_lifecycle_event;
const TARGET_IS_PRODUCT = NPM_TARGET?.endsWith(':product');
const targetIsDevServer = NPM_TARGET === 'dev-server';
let mode = 'production';
let devtool = 'source-map';
if (NPM_TARGET === 'debug' || NPM_TARGET === 'debug:watch' || targetIsDevServer) {
    mode = 'development';
    devtool = 'eval-cheap-module-source-map';
}

const plugins = [];
if (NPM_TARGET === 'build:watch' || NPM_TARGET === 'debug:watch') {
    plugins.push({
        apply: (compiler) => {
            compiler.hooks.watchRun.tap('WatchStartPlugin', () => {
                console.log('Change detected. Rebuilding webapp.');
            });
            compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
                exec('cd .. && make deploy-from-watch', (err, stdout, stderr) => {
                    if (stdout) {
                        process.stdout.write(stdout);
                    }
                    if (stderr) {
                        process.stderr.write(stderr);
                    }
                });
            });
        },
    });
}

if (targetIsDevServer) {
    plugins.push(new ReactRefreshWebpackPlugin());
}

let config = {
    entry: './src/remote_entry.ts',
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src/'),
            'mattermost-redux': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/mattermost-redux/src/'),
            reselect: path.resolve(__dirname, './node_modules/mattermost-webapp/packages/reselect/src/index'),
            '@mattermost/client': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/client/src/'),
            '@mattermost/components': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/components/src/'),
        },
        modules: [
            'src',
            'node_modules',
        ],
        extensions: ['*', '.js', '.jsx', '.ts', '.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules\/(?!(mattermost-webapp)\/).*/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,

                        // Babel configuration is in babel.config.js because jest requires it to be there.
                    },
                },
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                    },
                    {
                        loader: 'sass-loader',
                    },
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg|jpeg)$/,
                type: 'asset/inline', // consider 'asset' when URL resource chunks are supported
            },
            {
                test: /\.apng$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'files/[contenthash].[ext]',
                        },
                    },
                ],
            },
        ],
    },
    devtool,
    mode,
    plugins,
};

if (TARGET_IS_PRODUCT) {
    // Set up module federation
    function makeSingletonSharedModules(packageNames) {
        const sharedObject = {};

        for (const packageName of packageNames) {
            sharedObject[packageName] = {

                // Ensure only one copy of this package is ever loaded
                singleton: true,

                // Set this to false to prevent Webpack from packaging any "fallback" version of this package so that
                // only the version provided by the web app will be used
                import: false,

                // Set these to false so that any version provided by the web app will be accepted
                requiredVersion: false,
                version: false,
            };
        }

        return sharedObject;
    }

    config.plugins.push(new ModuleFederationPlugin({
        name: 'playbooks',
        filename: 'remote_entry.js',
        exposes: {
            '.': './src/index',

            // This probably won't need to be exposed in the long run, but its a POC for exposing multiple modules
            './manifest': './src/manifest',
        },
        shared: [
            '@mattermost/client',

            'luxon',

            makeSingletonSharedModules([
                'react',
                'react-dom',
                'react-intl',
                'react-redux',
                'react-router-dom',
                'styled-components',
            ]),
        ],
    }));

    config.plugins.push(new webpack.DefinePlugin({
        'process.env.TARGET_IS_PRODUCT': TARGET_IS_PRODUCT, // TODO We might want a better name for this
    }));

    config.output = {
        path: path.join(__dirname, '/dist'),
        chunkFilename: '[name].[contenthash].js',
    };
} else {
    config.resolve.alias['react-intl'] = path.resolve(__dirname, '../../webapp/node_modules/react-intl/');

    config.externals = {
        react: 'React',
        'react-dom': 'ReactDOM',
        redux: 'Redux',
        luxon: 'Luxon',
        'react-redux': 'ReactRedux',
        'prop-types': 'PropTypes',
        'react-bootstrap': 'ReactBootstrap',
        'react-router-dom': 'ReactRouterDom',
        'react-intl': 'ReactIntl',
    };

    config.output = {
        devtoolNamespace: PLUGIN_ID,
        path: path.join(__dirname, '/dist'),
        publicPath: '/',
        filename: 'main.js',
    };
}

if (targetIsDevServer) {
    config = {
        ...config,
        devServer: {
            hot: true,
            liveReload: false,
            proxy: [{
                context: () => true,
                bypass(req) {
                    if (req.url.indexOf('/static/plugins/playbooks/') === 0) {
                        return '/main.js'; // return the webpacked asset
                    }
                    return null;
                },
                logLevel: 'silent',
                target: 'http://localhost:8065',
                xfwd: true,
                ws: true,
            }],
            port: 9005,
        },
        performance: false,
        optimization: {
            ...config.optimization,
            splitChunks: false,
        },
    };
}

if (NPM_TARGET === 'start:product') {
    const url = new URL(process.env.MM_PLAYBOOKS_DEV_SERVER_URL ?? 'http://localhost:9007');

    config.devServer = {
        server: {
            type: url.protocol.substring(0, url.protocol.length - 1),
            options: {
                minVersion: process.env.MM_SERVICESETTINGS_TLSMINVER ?? 'TLSv1.2',
                key: process.env.MM_SERVICESETTINGS_TLSKEYFILE,
                cert: process.env.MM_SERVICESETTINGS_TLSCERTFILE,
            },
        },
        host: url.hostname,
        port: url.port,
        devMiddleware: {
            writeToDisk: false,
        },
    };
}

module.exports = config;
