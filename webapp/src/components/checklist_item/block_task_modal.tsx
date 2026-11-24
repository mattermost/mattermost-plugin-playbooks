// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {searchProfiles} from 'mattermost-redux/actions/users';
import {UserProfile} from '@mattermost/types/users';
import {OptionTypeBase, StylesConfig} from 'react-select';

import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';
import {BaseTextArea} from 'src/components/assets/inputs';
import ProfileAutocomplete from 'src/components/backstage/profile_autocomplete';
import {useAppDispatch} from 'src/hooks/redux';

export const MAX_BLOCKED_REASON_LENGTH = 500;
export const MAX_BLOCKED_BY_USERS = 10;

interface Props {
    taskTitle: string;
    onConfirm: (reason: string, blockedByUserIds: string[]) => Promise<void>;
    onCancel: () => void;
}

const BlockTaskModal = ({taskTitle, onConfirm, onCancel}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useAppDispatch();
    const [reason, setReason] = useState('');
    const [blockedBy, setBlockedBy] = useState<UserProfile[]>([]);
    const [saving, setSaving] = useState(false);
    const trimmed = reason.trim();

    const searchUsers = (term: string) => dispatch(searchProfiles(term) as any);

    const handleConfirm = async () => {
        setSaving(true);
        try {
            await onConfirm(trimmed, blockedBy.map((user) => user.id));
        } finally {
            setSaving(false);
        }
    };

    return (
        <GenericModal
            id='playbooks-block-task-modal'
            modalHeaderText={formatMessage({defaultMessage: 'Mark task as blocked'})}
            onHide={onCancel}
            showCancel={true}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Mark as blocked'})}
            handleConfirm={handleConfirm}
            isConfirmDisabled={saving || trimmed === '' || blockedBy.length > MAX_BLOCKED_BY_USERS}
            autoCloseOnConfirmButton={false}
        >
            <Body>
                <TaskTitle>{taskTitle}</TaskTitle>
                <InlineLabel>{formatMessage({defaultMessage: 'What is it waiting on?'})}</InlineLabel>
                <BaseTextArea
                    data-testid='block-task-reason'
                    autoFocus={true}
                    rows={3}
                    maxLength={MAX_BLOCKED_REASON_LENGTH}
                    value={reason}
                    placeholder={formatMessage({defaultMessage: 'For example: waiting on legal approval'})}
                    onChange={(e) => setReason(e.target.value)}
                />
                <InlineLabel>{formatMessage({defaultMessage: 'Who is it waiting on? (optional)'})}</InlineLabel>
                <ProfileAutocomplete
                    searchProfiles={searchUsers}
                    userIds={[]}
                    isMultiMode={true}
                    autoFocus={false}
                    customSelectStyles={selectStyles}
                    setValues={(users) => setBlockedBy(users ?? [])}
                    placeholder={formatMessage({defaultMessage: 'Search for people'})}
                />
                <Hint>
                    {formatMessage({defaultMessage: 'They are mentioned in the run channel, or sent a direct message with a link to the run if they are not in the channel.'})}
                </Hint>
            </Body>
        </GenericModal>
    );
};

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const TaskTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
`;

const Hint = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    line-height: 16px;
`;

const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided) => ({
        ...provided,
        backgroundColor: 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        minHeight: '40px',
        fontSize: '14px',
        '&&:before': {content: 'none'},
    }),
};

export default BlockTaskModal;
