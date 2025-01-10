// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-webapp/packages/types/src/store';
import {useSelector} from 'react-redux';

import {BotSelector, Bot, BotsLoaderHook} from './types/ai';

export const aiPluginID = 'mattermost-ai';

export const useAIAvailable = () => {
    //@ts-ignore plugins state is a thing
    return useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.[aiPluginID]));
};

export const useAIAvailableBots = () => {
    return useSelector<GlobalState, Bot[]>((state) => {
        //@ts-ignore plugins state is a thing
        return state['plugins-' + aiPluginID]?.bots || [];
    });
};

export const useBotSelector = () => {
    return useSelector<GlobalState, BotSelector>((state) => {
        //@ts-ignore plugins state is a thing
        return state['plugins-' + aiPluginID]?.botSelector;
    });
};

export const useBotsLoaderHook = () => {
    return useSelector<GlobalState, BotsLoaderHook>((state) => {
        //@ts-ignore plugins state is a thing
        return state['plugins-' + aiPluginID]?.botsLoaderHook || (() => null);
    });
};

