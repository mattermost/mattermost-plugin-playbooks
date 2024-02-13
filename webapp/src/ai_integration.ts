// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-webapp/packages/types/src/store';
import {useSelector} from 'react-redux';

export const aiPluginID = 'mattermost-ai';

export const useAIAvailable = () => {
    //@ts-ignore plugins state is a thing
    return useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.[aiPluginID]));
};

export type AIStatusUpdateClickedFunc = ((playbookRunId: string) => string) | undefined;

export const useAIStatusUpdateClicked = () => {
    return useSelector<GlobalState, AIStatusUpdateClickedFunc>((state) => {
        //@ts-ignore plugins state is a thing
        return state['plugins-' + aiPluginID]?.aiStatusUpdateClicked;
    });
};

