// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';

import {useDispatch} from 'react-redux';

import {getProfiles, searchProfiles} from 'mattermost-redux/actions/users';

import {fetchGlobalSettings, setGlobalSettings} from 'src/client';
import {GlobalSettings} from 'src/types/settings';

import {PROFILE_CHUNK_SIZE} from 'src/constants';

import InviteUsersSelector from './automation/invite_users_selector';
import {AutomationHeader, AutomationTitle, SelectorWrapper} from './automation/styles';
import {Toggle} from './automation/toggle';
import {BackstageHeader, BackstageHorizontalContentSquish} from './styles';

interface PlaybookCreatorsProps {
    settings: GlobalSettings
    onChange: (newsettings: GlobalSettings) => void
}

const PlaybookCreators: FC<PlaybookCreatorsProps> = (props: PlaybookCreatorsProps) => {
    const dispatch = useDispatch();
    const [enabled, setEnabled] = useState<boolean>(props.settings.playbook_editors_user_ids !== []);

    const userMaybeAdded = (userid: string) => {
        if (!props.settings.playbook_editors_user_ids) {
            props.onChange({
                ...props.settings,
                playbook_editors_user_ids: [userid],
            });
            return;
        }

        // Need to ignore double adds
        if (props.settings.playbook_editors_user_ids.includes(userid)) {
            return;
        }

        props.onChange({
            ...props.settings,
            playbook_editors_user_ids: [...props.settings.playbook_editors_user_ids, userid],
        });
    };

    const removeUser = (userid: string) => {
        if (!props.settings.playbook_editors_user_ids) {
            return;
        }
        const idx = props.settings.playbook_editors_user_ids.indexOf(userid);
        props.onChange({
            ...props.settings,
            playbook_editors_user_ids: [...props.settings.playbook_editors_user_ids.slice(0, idx), ...props.settings.playbook_editors_user_ids.slice(idx + 1)],
        });
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term));
    };

    const getUsers = () => {
        return dispatch(getProfiles(0, PROFILE_CHUNK_SIZE, {active: true}));
    };

    const toggledEnable = () => {
        if (enabled) {
            props.onChange({
                ...props.settings,
                playbook_editors_user_ids: [],
            });
        }
        setEnabled(!enabled);
    };

    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={enabled}
                    onChange={toggledEnable}
                />
                <div>{'Playbook Creators'}</div>
            </AutomationTitle>
            <SelectorWrapper>
                <InviteUsersSelector
                    isDisabled={!enabled}
                    userIds={props.settings.playbook_editors_user_ids || []}
                    onAddUser={userMaybeAdded}
                    onRemoveUser={removeUser}
                    searchProfiles={searchUsers}
                    getProfiles={getUsers}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

const SettingsView: FC = () => {
    const [settings, setSettings] = useState<GlobalSettings | null>(null);

    const updateSettings = (newsettings: GlobalSettings) => {
        setSettings(newsettings);
        setGlobalSettings(newsettings);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            setSettings(await fetchGlobalSettings());
        };
        fetchSettings();
    }, []);

    if (!settings) {
        return null;
    }

    return (
        <BackstageHorizontalContentSquish>
            <BackstageHeader data-testid='titleStats'>
                {'Settings'}
            </BackstageHeader>
            <PlaybookCreators
                settings={settings}
                onChange={updateSettings}
            />
        </BackstageHorizontalContentSquish>
    );
};

export default SettingsView;
