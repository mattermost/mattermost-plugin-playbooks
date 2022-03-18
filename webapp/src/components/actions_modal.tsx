// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {mdiLightningBoltOutline} from '@mdi/js';

import {getCurrentChannelId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import Icon from '@mdi/react';

import {fetchChannelActions, saveChannelAction} from 'src/client';
import {hideActionsModal} from 'src/actions';
import {isActionsModalVisible, isCurrentUserChannelAdmin, isCurrentUserAdmin} from 'src/selectors';
import GenericModal, {ModalSubheading} from 'src/components/widgets/generic_modal';
import Action from 'src/components/actions_modal_action';
import Trigger from 'src/components/actions_modal_trigger';
import {ChannelAction, ChannelActionType, ActionsByTrigger, ChannelTriggerType} from 'src/types/channel_actions';

const defaultActions: ActionsByTrigger = {
    [ChannelTriggerType.NewMemberJoins]: [
        {
            channel_id: '',
            enabled: false,
            action_type: ChannelActionType.WelcomeMessage,
            trigger_type: ChannelTriggerType.NewMemberJoins,
            payload: {
                message: '',
            },
        },
    ],
    [ChannelTriggerType.KeywordsPosted]: [
        {
            channel_id: '',
            enabled: false,
            action_type: ChannelActionType.PromptRunPlaybook,
            trigger_type: ChannelTriggerType.KeywordsPosted,
            payload: {
                keywords: [],
                playbook_id: '',
            },
        },
    ],
};

const ActionsModal = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const show = useSelector(isActionsModalVisible);
    const channelID = useSelector(getCurrentChannelId);
    const isChannelAdmin = useSelector(isCurrentUserChannelAdmin);
    const isSysAdmin = useSelector(isCurrentUserAdmin);

    const editable = isChannelAdmin || isSysAdmin;

    const [originalActions, setOriginalActions] = useState({} as ActionsByTrigger);
    const [currentActions, setCurrentActions] = useState(defaultActions);

    useEffect(() => {
        const getActions = async (id: string) => {
            const fetchedActions = await fetchChannelActions(id);

            const record = {} as ActionsByTrigger;
            fetchedActions.forEach((action) => {
                const array = record[action.trigger_type];
                if (array) {
                    record[action.trigger_type].push(action);
                } else {
                    record[action.trigger_type] = [action];
                }
            });

            setOriginalActions(record);
            setCurrentActions({...defaultActions, ...record});
        };

        if (channelID) {
            getActions(channelID);
        }
    }, [channelID]);

    const onHide = () => {
        // Restore the state to the original actions
        setCurrentActions({...defaultActions, ...originalActions});
        dispatch(hideActionsModal());
    };

    const onSave = () => {
        Object.values(currentActions).forEach((actions) => {
            actions.forEach((action) => {
                action.channel_id = channelID;
                saveChannelAction(action);
            });
        });
        setOriginalActions(currentActions);
    };

    const onUpdateAction = (newAction: ChannelAction) => {
        setCurrentActions((prevActions: ActionsByTrigger) => {
            // TODO: Change this deep cloning
            const newActions = JSON.parse(JSON.stringify(prevActions));

            const idx = prevActions[newAction.trigger_type]?.findIndex((action) => action.action_type === newAction.action_type);
            if (idx !== null) {
                newActions[newAction.trigger_type][idx] = newAction;
            }

            return newActions;
        });
    };

    const header = (
        <Header>
            <ActionsIcon
                path={mdiLightningBoltOutline}
                size={1.6}
            />
            <div>
                {formatMessage({defaultMessage: 'Channel Actions'})}
                <ModalSubheading>
                    {formatMessage({defaultMessage: 'Channel actions allow you to automate activities for this channel'})}
                </ModalSubheading>
            </div>
        </Header>
    );

    return (
        <GenericModal
            id={'channel-actions-modal'}
            modalHeaderText={header}
            show={show}
            onHide={onHide}
            handleCancel={editable ? onHide : null}
            handleConfirm={editable ? onSave : null}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!editable}
            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            enforceFocus={true}
            adjustTop={400}
        >
            <TriggersContainer>
                {Object.entries(currentActions).map(([trigger, actions]) => (
                    <Trigger
                        key={trigger}
                        editable={editable}
                        triggerType={trigger as ChannelTriggerType}
                        actions={actions}
                        onUpdate={onUpdateAction}
                    >
                        {actions.map((action) => (
                            <Action
                                key={action.id}
                                action={action}
                                editable={editable}
                                onUpdate={onUpdateAction}
                            />
                        ))}
                    </Trigger>
                ))}
            </TriggersContainer>
        </GenericModal>
    );
};

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const ActionsIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 14px;
    margin-top: 2px;
`;

const TriggersContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 16px;
`;

export default ActionsModal;
