// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import RHSParticipant from 'src/components/rhs/rhs_participant';

interface Props {
    userIds: string[];
}

const RHSParticipants = (props: Props) => {
    const openMembersModal = useOpenMembersModalIfPresent();

    if (props.userIds.length === 0) {
        return (
            <NoParticipants>
                {'Nobody yet. '}
                <AddParticipants/>
            </NoParticipants>
        );
    }

    return (
        <UserRow onClick={openMembersModal}>
            {props.userIds.slice(0, 6).map((userId: string) => (
                <RHSParticipant
                    key={userId}
                    userId={userId}
                />
            ))}
            {props.userIds.length > 6 &&
            <Rest>{'+' + (props.userIds.length - 6)}</Rest>
            }
        </UserRow>
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
            onClick={() => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.CHANNEL_INVITE,
                    dialogType: ChannelInviteModal,
                    dialogProps: {channel},
                }));
            }}
        >
            {'Add participants?'}
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

    :hover {
        outline: 6px solid rgba(var(--center-channel-color-rgb), 0.08);
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    margin-top: 6px;
    margin-left: 5px;
`;

const leftHoleSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M 3.8043 4.4058 A 14 14 0 1 1 3.8043 23.5942 A 16 16 0 0 0 3.8043 4.4058 Z"/></svg>';

const Rest = styled.div`
    width: 28px;
    height: 28px;
    margin-left: -5px;
    border-radius: 50%;

    background-color: rgba(var(--center-channel-color-rgb), 0.16);
    color: rgba(var(--center-channel-color-rgb), 0.72);

    font-weight: 600;
    font-size: 11px;

    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 6;

    div:hover + &&& {
        mask-image: url('${leftHoleSvg}');
    }
`;

export default RHSParticipants;
