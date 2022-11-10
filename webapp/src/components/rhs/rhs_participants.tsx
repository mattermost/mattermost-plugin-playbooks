// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import {OpenInNewIcon, AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import Tooltip from 'src/components/widgets/tooltip';
import {RHSParticipant, Rest} from 'src/components/rhs/rhs_participant';
import {setRHSViewingParticipants} from 'src/actions';

interface Props {
    userIds: string[];
    onParticipate?: () => void;
}

const RHSParticipants = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const openMembersModal = useOpenMembersModalIfPresent();

    const onShowParticipants = () => {
        dispatch(setRHSViewingParticipants());
        return false;
    };
    const becomeParticipant = (
        <Tooltip
            id={'rhs-participate'}
            content={formatMessage({defaultMessage: 'Become a participant'})}
        >
            <IconWrapper
                onClick={props.onParticipate}
                data-testid={'rhs-participate-icon'}
                format={props.userIds.length === 0 ? 'icontext' : 'icon'}
            >
                <AccountPlusOutlineIcon size={16}/>
                {props.userIds.length === 0 ? formatMessage({defaultMessage: 'Participate'}) : null}
            </IconWrapper>
        </Tooltip>
    );

    if (props.userIds.length === 0) {
        return (
            <Container>
                <NoParticipants>
                    <FormattedMessage defaultMessage='Nobody yet.'/>
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {' '}
                    {props.onParticipate ? null : (
                        <LinkAddParticipants
                            to={'#'}
                            onClick={onShowParticipants}
                        >
                            {formatMessage({defaultMessage: 'Add participant'})}
                            <OpenInNewIcon size={11}/>
                        </LinkAddParticipants>
                    )}
                </NoParticipants>
                {props.onParticipate ? becomeParticipant : null}
            </Container>
        );
    }

    const height = 28;

    return (
        <Container>
            <UserRow
                tabIndex={0}
                role={'button'}
                onClick={onShowParticipants}
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
            {props.onParticipate ? becomeParticipant : null}
        </Container>
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

const Container = styled.div`
    padding: 0;
    display: flex;
    flex-direction: row;
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

const IconWrapper = styled.div<{format: 'icon' | 'icontext'}>`
    margin-left: 10px;
    margin-top: 6px;
    padding: 0 ${(props) => (props.format === 'icontext' ? '8px' : '0')};
    border-radius: ${(props) => (props.format === 'icontext' ? '15px' : '50%')};
    border: 1px dashed rgba(var(--center-channel-color-rgb), 0.56);
    color: rgba(var(--center-channel-color-rgb), 0.56);
    width: ${(props) => (props.format === 'icontext' ? 'auto' : '28px')};
    height: 28px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.72);
        border: 1px dashed rgba(var(--center-channel-color-rgb), 0.72);
        background: rgba(var(--center-channel-color-rgb), 0.04);

    }
    svg {
        margin-right: ${(props) => (props.format === 'icontext' ? '4px' : '0')};
    }
`;

const LinkAddParticipants = styled(Link)`
    display: inline-flex;
    align-items: center;
    svg {
        margin-left: 2px;
    }
`;
