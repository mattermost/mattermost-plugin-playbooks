import React, {FC, useState} from 'react';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import General from 'mattermost-redux/constants/general';

import Spinner from 'src/components/assets/icons/spinner';

import UpgradeTimelineSvg from 'src/components/assets/upgrade_timeline_svg';
import {PrimaryButton} from 'src/components/assets/buttons';
import {getAdminAnalytics} from 'src/selectors';
import StartTrialNotice from 'src/components/backstage/start_trial_notice';

import {requestTrialLicense, postMessageToAdmins} from 'src/client';

import {AdminNotificationType} from 'src/constants';

enum ActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}
    type HandlerType = undefined | (() => (Promise<void> | void));

const TimelineUpgradePlaceholder : FC = () => {
    const currentUser = useSelector(getCurrentUser);
    const isCurrentUserAdmin = isSystemAdmin(currentUser.roles);
    const [actionState, setActionState] = useState(ActionState.Uninitialized);

    const analytics = useSelector(getAdminAnalytics);
    const serverTotalUsers = analytics?.TOTAL_USERS || 0;

    const notifyAdmins = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        setActionState(ActionState.Loading);

        await postMessageToAdmins(AdminNotificationType.VIEW_TIMELINE);
        setActionState(ActionState.Success);
    };

    const requestLicense = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        setActionState(ActionState.Loading);

        const requestedUsers = Math.max(serverTotalUsers, 30);
        const response = await requestTrialLicense(requestedUsers);
        if (response.error) {
            setActionState(ActionState.Error);
        } else {
            setActionState(ActionState.Success);
        }
    };

    let helpText = 'Make retros easy. Your timeline includes all the events in your incident, separated by type, and downloadable for offline review.';
    if (actionState === ActionState.Success) {
        helpText = 'A notification has been sent to your administrator.';
    }

    return (
        <UpgradeWrapper>
            <UpgradeTimelineSvg/>
            <UpgradeContent>
                <UpgradeHeader>
                    <Title>{'Keep all your incident events in one place'}</Title>
                    <HelpText>{helpText}</HelpText>
                </UpgradeHeader>
                <Button
                    actionState={actionState}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    notifyAdmins={notifyAdmins}
                    requestLicense={requestLicense}
                />
                {isCurrentUserAdmin && actionState === ActionState.Uninitialized && <Footer/> }
            </UpgradeContent>
        </UpgradeWrapper>
    );
};

const FooterContainer = styled.div`
    font-size: 11px;
    line-height: 16px;

    display: flex;
    align-items: center;
    text-align: center;

    color: rgba(var(--center-channel-color, 0.56));

    margin-top: 18px;
`;

const Footer = () => (
    <FooterContainer>
        <StartTrialNotice/>
    </FooterContainer>
);

interface ButtonProps {
    actionState: ActionState;
    isCurrentUserAdmin: boolean;
    notifyAdmins: HandlerType;
    requestLicense: HandlerType;
}

const Button : FC<ButtonProps> = (props: ButtonProps) => {
    if (props.actionState === ActionState.Loading) {
        return <Spinner/>;
    }

    if (props.actionState === ActionState.Success) {
        return null;
    }

    let buttonText = 'Notify Administrator';
    let handleClick : HandlerType = props.notifyAdmins;

    if (props.isCurrentUserAdmin) {
        handleClick = props.requestLicense;
        buttonText = 'Start trial';
    }

    return (
        <PrimaryButton
            onClick={handleClick}
        >
            {buttonText}
        </PrimaryButton>
    );
};

const isSystemAdmin = (roles: string): boolean => {
    const rolesArray = roles.split(' ');
    return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
};

const UpgradeContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 30px;
    margin-top: -330px;
`;

const CenteredRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

const Title = styled(CenteredRow)`
    text-align: center;
    margin-bottom: 8px;

    font-weight: 600;
    font-size: 24px;
    color: rgba(var(--center-channel-color-rgb), 1);
`;

const HelpText = styled(CenteredRow)`
    text-align: center;
    font-weight: 400;
    font-size: 12px;
    color: var(--center-channel-color);
`;

const UpgradeHeader = styled.div`
    margin-bottom: 14px;
`;

const UpgradeWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;

export default TimelineUpgradePlaceholder;
