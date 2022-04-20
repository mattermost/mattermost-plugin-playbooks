// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';

import {getCurrentChannelId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import cloneDeep from 'lodash';

import {fetchChannelActions, saveChannelAction} from 'src/client';
import {hideChannelActionsModal} from 'src/actions';
import {isChannelActionsModalVisible, isCurrentUserChannelAdmin, isCurrentUserAdmin} from 'src/selectors';
import Action from 'src/components/actions_modal_action';
import Trigger from 'src/components/actions_modal_trigger';
import {ChannelAction, ChannelActionType, ActionsByTrigger, ChannelTriggerType, equalActionType} from 'src/types/channel_actions';

import ActionsModal, {ActionsContainer, TriggersContainer} from 'src/components/actions_modal';

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
        {
            channel_id: '',
            enabled: false,
            action_type: ChannelActionType.CategorizeChannel,
            trigger_type: ChannelTriggerType.NewMemberJoins,
            payload: {
                category_name: '',
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

const ChannelActionsModal = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const show = useSelector(isChannelActionsModalVisible);
    const channelID = useSelector(getCurrentChannelId);
    const isChannelAdmin = useSelector(isCurrentUserChannelAdmin);
    const isSysAdmin = useSelector(isCurrentUserAdmin);

    const editable = isChannelAdmin || isSysAdmin;

    const [actionsChanged, setActionsChanged] = useState(false);
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

            // Merge the fetched actions with the default ones
            Object.entries(record).forEach(([triggerString, actionsInRecord]) => {
                const trigger = triggerString as ChannelTriggerType;
                const finalActions = [] as ChannelAction[];
                defaultActions[trigger].forEach((defaultAction: ChannelAction) => {
                    const actionFetched = actionsInRecord.find((actionInRecord) => equalActionType(actionInRecord, defaultAction));
                    if (actionFetched) {
                        finalActions.push(actionFetched);
                    } else {
                        finalActions.push(defaultAction);
                    }
                });
                record[trigger] = finalActions;
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
        dispatch(hideChannelActionsModal());
    };

    const onSave = () => {
        if (!actionsChanged) {
            return;
        }

        const newActions = cloneDeep(currentActions).value();
        const saveActionPromises = [] as Promise<void>[];

        Object.values(newActions).forEach((actions) => {
            actions.forEach((action) => {
                action.channel_id = channelID;
                const promise = saveChannelAction(action).then((newID) => {
                    if (!action.id) {
                        action.id = newID;
                    }
                });
                saveActionPromises.push(promise);
            });
        });

        // Wait until all save calls have ended (successfully or not)
        // before setting both the current and original actions
        Promise.allSettled(saveActionPromises).then(() => {
            setCurrentActions(newActions);
            setOriginalActions(newActions);
        });

        dispatch(hideChannelActionsModal());
    };

    const onUpdateAction = (newAction: ChannelAction) => {
        setActionsChanged(true);

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

    return (
        <ActionsModal
            id={'channel-actions-modal'}
            title={formatMessage({defaultMessage: 'Channel Actions'})}
            subtitle={formatMessage({defaultMessage: 'Channel actions allow you to automate activities for this channel'})}
            show={show}
            onHide={onHide}
            editable={editable}
            onSave={onSave}
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
                        <ActionsContainer>
                            {actions.map((action) => (
                                <Action
                                    key={action.id}
                                    action={action}
                                    editable={editable}
                                    onUpdate={onUpdateAction}
                                />
                            ))}
                        </ActionsContainer>
                    </Trigger>
                ))}
            </TriggersContainer>
        </ActionsModal>
    );
};

export default ChannelActionsModal;
