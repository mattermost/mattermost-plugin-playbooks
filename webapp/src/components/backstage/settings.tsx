// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import {getProfiles, searchProfiles} from 'mattermost-redux/actions/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import {actionSetGlobalSettings} from 'src/actions';
import {fetchGlobalSettings, setGlobalSettings} from 'src/client';
import {PROFILE_CHUNK_SIZE} from 'src/constants';
import {globalSettings} from 'src/selectors';
import {GlobalSettings} from 'src/types/settings';
import ConfirmModal from '../widgets/confirmation_modal';

import Profile from '../profile/profile';

import {useCanCreatePlaybooks} from 'src/hooks';

import InviteUsersSelector from './automation/invite_users_selector';
import {BackstageHeader, BackstageSubheader, RadioContainer, RadioLabel, RadioInput} from './styles';

const SettingsContainer = styled.div`
    margin: 0 auto;
    max-width: 700px;
`;

const NoPermissionsTitle = styled.div`
    font-weight: 600;
    margin-bottom: 1rem;
`;

const NoPermissionsUsers = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
`;

const NoPermissionsUserEntry = styled.div`
    margin: 5px;
`;

const UserSelectorWrapper = styled.div`
    margin-left: 24px;
    width: 300px;
    height: 40px;
`;

interface PlaybookCreatorsProps {
    settings: GlobalSettings
    onChange: (newsettings: GlobalSettings) => void
}

const PlaybookCreators: FC<PlaybookCreatorsProps> = (props: PlaybookCreatorsProps) => {
    const dispatch = useDispatch();
    const [enabled, setEnabled] = useState<boolean>(Boolean(props.settings.playbook_editors_user_ids) && props.settings.playbook_editors_user_ids?.length !== 0);
    const [confirmRemoveSelfOpen, setConfirmRemoveSelfOpen] = useState('');
    const hasPermissions = useCanCreatePlaybooks();
    const currentUserId = useSelector<GlobalState, string>(getCurrentUserId);

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

    const radioPressed = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('HERE!~');
        console.log(e.target.value);
        if (e.target.value === 'enabled') {
            if (!enabled) {
                props.onChange({
                    ...props.settings,
                    playbook_editors_user_ids: [currentUserId],
                });
                setEnabled(true);
            }
        } else {
            props.onChange({
                ...props.settings,
                playbook_editors_user_ids: [],
            });
            setEnabled(false);
        }
    };

    if (!hasPermissions) {
        return (
            <>
                <NoPermissionsTitle>{'Playbook creation is currenty restricted to these users:'}</NoPermissionsTitle>
                <NoPermissionsUsers>
                    {props.settings.playbook_editors_user_ids?.map((userId) => (
                        <NoPermissionsUserEntry
                            key={userId}
                        >
                            <Profile userId={userId}/>
                        </NoPermissionsUserEntry>
                    ))}
                </NoPermissionsUsers>
            </>
        );
    }

    return (
        <>
            <BackstageSubheader>
                {'Playbook creation'}
            </BackstageSubheader>
            <RadioContainer>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='disabled'
                        checked={!enabled}
                        onChange={radioPressed}
                    />
                    {'Everyone on the server can create playbooks'}
                </RadioLabel>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='enabled'
                        checked={enabled}
                        onChange={radioPressed}
                    />
                    {'Only selected people can create playbooks'}
                </RadioLabel>
            </RadioContainer>
            <UserSelectorWrapper>
                {enabled &&
                    <InviteUsersSelector
                        isDisabled={false}
                        userIds={props.settings.playbook_editors_user_ids || []}
                        onAddUser={userMaybeAdded}
                        onRemoveUser={(userid: string) => {
                            if (userid === currentUserId) {
                                setConfirmRemoveSelfOpen(currentUserId);
                                return;
                            }
                            removeUser(userid);
                        }}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                    />
                }
            </UserSelectorWrapper>
            <ConfirmModal
                show={confirmRemoveSelfOpen !== ''}
                title={'Confirm Remove Self'}
                message={'Are you sure you want to remove yourelf as a playbook creator? You will not be able to add yourself back.'}
                confirmButtonText={'RemoveSelf'}
                onConfirm={() => {
                    removeUser(confirmRemoveSelfOpen);
                    setConfirmRemoveSelfOpen('');
                }}
                onCancel={() => setConfirmRemoveSelfOpen('')}
            />
        </>
    );
};

const SettingsView: FC = () => {
    const dispatch = useDispatch();
    const settings = useSelector(globalSettings);

    const updateSettings = (newsettings: GlobalSettings) => {
        dispatch(actionSetGlobalSettings(newsettings));
        setGlobalSettings(newsettings);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));
        };
        fetchSettings();
    }, []);

    if (!settings) {
        return null;
    }

    return (
        <SettingsContainer>
            <BackstageHeader data-testid='titleStats'>
                {'Settings'}
            </BackstageHeader>
            <PlaybookCreators
                settings={settings}
                onChange={updateSettings}
            />
        </SettingsContainer>
    );
};

export default SettingsView;
