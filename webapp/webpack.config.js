const exec = require('child_process').exec;

const path = require('path');

const {ModuleFederationPlugin} = require('webpack').container;

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const PLUGIN_ID = require('../plugin.json').id;

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env
const targetIsDevServer = NPM_TARGET === 'dev-server';
let mode = 'production';
let devtool = 'source-map';
if (NPM_TARGET === 'debug' || NPM_TARGET === 'debug:watch' || targetIsDevServer) {
    mode = 'development';
    devtool = 'eval-cheap-module-source-map';
}

const plugins = [
    new ModuleFederationPlugin({
        name: PLUGIN_ID,
        filename: 'remote_entry.js',
        exposes: {
            plugin: './src/index',
        },
        shared: {
            luxon: {
                singleton: true,
            },
            react: {
                singleton: true,
            },
            'react-bootstrap': {
                singleton: true,
            },
            'react-dom': {
                singleton: true,
            },
            'react-intl': {
                singleton: true,
            },
            'react-redux': {
                singleton: true,
            },
            'react-router-dom': {
                singleton: true,
            },
        },
    }),
];

if (NPM_TARGET === 'build:watch' || NPM_TARGET === 'debug:watch') {
    plugins.push({
        apply: (compiler) => {
            compiler.hooks.watchRun.tap('WatchStartPlugin', () => {
                // eslint-disable-next-line no-console
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
    entry: [
        './src/remote_entry.ts',
    ],
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src/'),
            'mattermost-redux': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/mattermost-redux/src/'),
            '@mattermost/types': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/types/src/'),
            reselect: path.resolve(__dirname, './node_modules/mattermost-webapp/packages/reselect/src/index'),
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
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'files/[contenthash].[ext]',
                        },
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {},
                    },
                ],
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

module.exports = config;
