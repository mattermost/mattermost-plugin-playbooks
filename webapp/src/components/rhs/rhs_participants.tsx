// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {RHSParticipant, Rest} from 'src/components/rhs/rhs_participant';

interface Props {
    userIds: string[];
}

const RHSParticipants = (props: Props) => {
    const openMembersModal = useOpenMembersModalIfPresent();

    if (props.userIds.length === 0) {
        return (
            <NoParticipants>
                <FormattedMessage defaultMessage='Nobody yet.'/>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {' '}
                <AddParticipants/>
            </NoParticipants>
        );
    }

    const height = 28;

    return (
        <UserRow
            tabIndex={0}
            role={'button'}
            onClick={openMembersModal}
            onKeyDown={(e) => {
                // Handle Enter and Space as clicking on the button
                if (e.keyCode === 13 || e.keyCode === 32) {
                    openMembersModal();
                }
            }}
        >
            <UserList
                userIds={props.userIds}
                sizeInPx={height}
            />
        </UserRow>
    );
};

export const UserList = ({userIds, sizeInPx}: {userIds: string[], sizeInPx: number}) => {
    return (
        <>
            {userIds.slice(0, 6).map((userId: string) => (
                <RHSParticipant
                    key={userId}
                    userId={userId}
                    sizeInPx={sizeInPx}
                />
            ))}
            {userIds.length > 6 &&
            // eslint-disable-next-line formatjs/no-literal-string-in-jsx
            <Rest sizeInPx={sizeInPx}>{'+' + (userIds.length - 6)}</Rest>
            }
        </>
    );
};

const useOpenMembersModalIfPresent = () => {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CHANNEL_MEMBERS || !window.Components?.ChannelMembersModal) {
        return () => {/* do nothing */};
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const ChannelMembersModal = window.Components.ChannelMembersModal;

    return () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_MEMBERS,
            dialogType: ChannelMembersModal,
            dialogProps: {channel},
        }));
    };
};

const AddParticipants = () => {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CHANNEL_INVITE || !window.Components?.ChannelInviteModal) {
        return null;
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const ChannelInviteModal = window.Components.ChannelInviteModal;

    return (
        <a
            href={'#'}
            tabIndex={0}
            role={'button'}
            onClick={(e) => {
                e.preventDefault();
                dispatch(openModal({
                    modalId: ModalIdentifiers.CHANNEL_INVITE,
                    dialogType: ChannelInviteModal,
                    dialogProps: {channel},
                }));
            }}
        >
            <FormattedMessage defaultMessage='Add participants?'/>
        </a>
    );
};

const NoParticipants = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 11px;
    line-height: 16px;

    margin-top: 12px;
`;

const UserRow = styled.div`
    width: max-content;
    padding: 0;
    display: flex;
    flex-direction: row;

    border-radius: 44px;

    margin-top: 6px;
    margin-left: 2px;

    :hover {
        border: 6px solid rgba(var(--center-channel-color-rgb), 0.08);
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-clip: padding-box;

        margin-top: 0;
        margin-left: -4px;
        margin-bottom: -6px;
    }
`;

export default RHSParticipants;
