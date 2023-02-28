const path = require('path');

const webpack = require('webpack');
const {ModuleFederationPlugin} = require('webpack').container;

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env
const TARGET_IS_PRODUCT = NPM_TARGET?.endsWith(':product');
const targetIsDevServer = NPM_TARGET === 'dev-server';
const mode = 'production';
const devtool = 'source-map';
const plugins = [];

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

// Set up module federation
function makeSingletonSharedModules(packageNames) {
    const sharedObject = {};

    for (const packageName of packageNames) {
        // Set both versions to false so that the version of this module provided by the web app will be used
        sharedObject[packageName] = {
            requiredVersion: false,
            singleton: true,
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
        '@types/luxon',
        '@types/react-bootstrap',

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
    const url = new URL(process.env.MM_PLAYBOOKS_DEV_SERVER_URL ?? 'http://localhost:9007'); //eslint-disable-line no-process-env

    config.devServer = {
        https: url.protocol === 'https:' && {
            minVersion: process.env.MM_SERVICESETTINGS_TLSMINVER, //eslint-disable-line no-process-env
            key: process.env.MM_SERVICESETTINGS_TLSKEYFILE, //eslint-disable-line no-process-env
            cert: process.env.MM_SERVICESETTINGS_TLSCERTFILE, //eslint-disable-line no-process-env
        },
        host: url.hostname,
        port: url.port,
        devMiddleware: {
            writeToDisk: false,
        },
    };
}

module.exports = config;
