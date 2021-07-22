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
            <SvgMaskDefinitions/>
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

const SvgMaskDefinitions = () => (
    <svg
        height='0'
        width='0'
    >
        <defs>
            <mask id='rightHole'>
                <circle
                    r='14'
                    cx='14'
                    cy='14'
                    fill='white'
                />
                <circle
                    r='16'
                    cx='37'
                    cy='14'
                    fill='black'
                />
            </mask>
            <mask id='leftHole'>
                <circle
                    r='14'
                    cx='14'
                    cy='14'
                    fill='white'
                />
                <circle
                    r='16'
                    cx='-9'
                    cy='14'
                    fill='black'
                />
            </mask>
            <mask id='bothHoles'>
                <circle
                    r='14'
                    cx='14'
                    cy='14'
                    fill='white'
                />
                <circle
                    r='16'
                    cx='37'
                    cy='14'
                    fill='black'
                />
                <circle
                    r='16'
                    cx='-9'
                    cy='14'
                    fill='black'
                />
            </mask>
        </defs>
    </svg>
);
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
        mask-image: url(#leftHole);
    }
`;

export default RHSParticipants;
