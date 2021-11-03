// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {getProfiles, searchProfiles} from 'mattermost-redux/actions/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {actionSetGlobalSettings} from 'src/actions';
import {fetchGlobalSettings, setGlobalSettings} from 'src/client';
import {PROFILE_CHUNK_SIZE, AdminNotificationType} from 'src/constants';
import {globalSettings, isCurrentUserAdmin} from 'src/selectors';
import {GlobalSettings} from 'src/types/settings';
import ConfirmModal from '../widgets/confirmation_modal';
import UpgradeBadge from 'src/components/backstage/upgrade_badge';

import Profile from '../profile/profile';

import {useCanRestrictPlaybookCreation, useAllowPlaybookCreationRestriction} from 'src/hooks';

import UpgradeModal from 'src/components/backstage/upgrade_modal';

import {BackstageHeader, BackstageSubheader, RadioContainer, RadioLabel, RadioInput} from './styles';
import SelectUsersBelow from './select_users_below';

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
    width: 400px;
    height: 40px;
`;

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 8px;
    margin-top: 2px;
`;

interface PlaybookCreatorsProps {
    settings: GlobalSettings
    onChange: (newsettings: GlobalSettings) => void
}

const PlaybookCreators = (props: PlaybookCreatorsProps) => {
    const allowPlaybookCreationRestriction = useAllowPlaybookCreationRestriction();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const dispatch = useDispatch();
    const [enabled, setEnabled] = useState<boolean>(props.settings.playbook_creators_user_ids.length !== 0);
    const [confirmRemoveSelfOpen, setConfirmRemoveSelfOpen] = useState('');
    const hasPermissions = useCanRestrictPlaybookCreation();
    const currentUserId = useSelector<GlobalState, string>(getCurrentUserId);
    const isAdmin = useSelector(isCurrentUserAdmin);

    const {formatMessage} = useIntl();

    const userMaybeAdded = (userid: string) => {
        // Need to ignore double adds
        if (props.settings.playbook_creators_user_ids.includes(userid)) {
            return;
        }

        props.onChange({
            ...props.settings,
            playbook_creators_user_ids: [...props.settings.playbook_creators_user_ids, userid],
        });
    };

    const removeUser = (userid: string) => {
        const idx = props.settings.playbook_creators_user_ids.indexOf(userid);
        if (idx < 0) {
            return;
        }
        props.onChange({
            ...props.settings,
            playbook_creators_user_ids: [...props.settings.playbook_creators_user_ids.slice(0, idx), ...props.settings.playbook_creators_user_ids.slice(idx + 1)],
        });
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term));
    };

    const getUsers = () => {
        return dispatch(getProfiles(0, PROFILE_CHUNK_SIZE, {active: true}));
    };

    const handleEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!allowPlaybookCreationRestriction) {
            setShowUpgradeModal(true);
            e.preventDefault();
            return;
        }

        if (!enabled) {
            props.onChange({
                ...props.settings,
                playbook_creators_user_ids: [currentUserId],
            });
            setEnabled(true);
        }
    };

    const handleDisabled = () => {
        props.onChange({
            ...props.settings,
            playbook_creators_user_ids: [],
        });
        setEnabled(false);
    };

    if (!hasPermissions) {
        if (props.settings.playbook_creators_user_ids.length === 0) {
            return (
                <NoPermissionsTitle>
                    {formatMessage({defaultMessage: 'Everyone in this workspace can create playbooks. System administrators may change this setting.'})}
                </NoPermissionsTitle>
            );
        }
        return (
            <>
                <NoPermissionsTitle>
                    {formatMessage({defaultMessage: 'Only the users below can create playbooks. These users, as well as system administrators, may change this setting.'})}
                </NoPermissionsTitle>
                <NoPermissionsUsers>
                    {props.settings.playbook_creators_user_ids.map((userId) => (
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
                {formatMessage({defaultMessage: 'Playbook creation'})}
            </BackstageSubheader>
            <RadioContainer>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='disabled'
                        checked={!enabled}
                        onChange={handleDisabled}
                    />
                    {formatMessage({defaultMessage: 'Everyone in this workspace can create playbooks.'})}
                </RadioLabel>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='enabled'
                        checked={enabled}
                        onChange={handleEnabled}
                    />
                    {formatMessage({defaultMessage: 'Only selected users can create playbooks.'})}
                    {!allowPlaybookCreationRestriction && <PositionedUpgradeBadge/>}
                </RadioLabel>
            </RadioContainer>
            <UserSelectorWrapper>
                {enabled &&
                    <SelectUsersBelow
                        userIds={props.settings.playbook_creators_user_ids}
                        onAddUser={userMaybeAdded}
                        onRemoveUser={(userid: string) => {
                            if (!isAdmin && userid === currentUserId) {
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
                title={formatMessage({defaultMessage: 'Remove from playbook'})}
                message={formatMessage({defaultMessage: 'After you remove your own access to this playbook, you won\'t be able to add yourself back. Are you sure you\'d like to perform this action?'})}
                confirmButtonText={formatMessage({defaultMessage: 'Remove'})}
                onConfirm={() => {
                    removeUser(confirmRemoveSelfOpen);
                    setConfirmRemoveSelfOpen('');
                }}
                onCancel={() => setConfirmRemoveSelfOpen('')}
            />
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK_CREATION_RESTRICTION}
                show={showUpgradeModal}
                onHide={() => setShowUpgradeModal(false)}
            />
        </>
    );
};

const SettingsView = () => {
    const dispatch = useDispatch();
    const settings = useSelector(globalSettings);

    const {formatMessage} = useIntl();

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
                {formatMessage({defaultMessage: 'Settings'})}
            </BackstageHeader>
            <PlaybookCreators
                settings={settings}
                onChange={updateSettings}
            />
        </SettingsContainer>
    );
};

export default SettingsView;
