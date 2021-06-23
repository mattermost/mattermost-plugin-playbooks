import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import General from 'mattermost-redux/constants/general';

import Spinner from 'src/components/assets/icons/spinner';

import UpgradeTimelineSvg from 'src/components/assets/upgrade_timeline_svg';
import UpgradeTimelineSuccessSvg from 'src/components/assets/upgrade_timeline_success_svg';
import UpgradeTimelineErrorSvg from 'src/components/assets/upgrade_timeline_error_svg';
import {PrimaryButton} from 'src/components/assets/buttons';
import {getAdminAnalytics, isTeamEdition} from 'src/selectors';
import StartTrialNotice from 'src/components/backstage/start_trial_notice';
import ConvertEnterpriseNotice from 'src/components/backstage/convert_enterprise_notice';

import {requestTrialLicense, postMessageToAdmins} from 'src/client';

import {AdminNotificationType} from 'src/constants';
import {isCloud} from 'src/license';
import {useOpenCloudModal} from 'src/hooks';

enum ActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}

type HandlerType = undefined | (() => (Promise<void> | void));

const TimelineUpgradePlaceholder = () => {
    const isServerCloud = useSelector(isCloud);
    const openCloudModal = useOpenCloudModal();
    const currentUser = useSelector(getCurrentUser);
    const isCurrentUserAdmin = isSystemAdmin(currentUser.roles);
    const [actionState, setActionState] = useState(ActionState.Uninitialized);
    const isServerTeamEdition = useSelector(isTeamEdition);

    const analytics = useSelector(getAdminAnalytics);
    const serverTotalUsers = analytics?.TOTAL_USERS || 0;

    const endUserMainAction = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        setActionState(ActionState.Loading);

        const response = await postMessageToAdmins(AdminNotificationType.VIEW_TIMELINE, isServerTeamEdition);
        if (response.error) {
            setActionState(ActionState.Error);
        } else {
            setActionState(ActionState.Success);
        }
    };

    const requestLicenseSelfHosted = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        setActionState(ActionState.Loading);

        const requestedUsers = Math.max(serverTotalUsers, 30);
        const response = await requestTrialLicense(requestedUsers, AdminNotificationType.VIEW_TIMELINE);
        if (response.error) {
            setActionState(ActionState.Error);
        } else {
            setActionState(ActionState.Success);
        }
    };

    const openUpgradeModal = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        openCloudModal();
    };

    let adminMainAction = requestLicenseSelfHosted;
    if (isServerCloud) {
        adminMainAction = openUpgradeModal;
    }

    let illustration = <UpgradeTimelineSvg/>;
    let titleText = 'Know what happened';
    let helpText : React.ReactNode = 'Make retrospectives easy with a timeline that automatically keeps track of the key events and messages so that teams have it at their fingertips.';

    if (isCurrentUserAdmin && isServerTeamEdition) {
        helpText = <><p>{helpText}</p><ConvertEnterpriseNotice/></>;
    }

    if (actionState === ActionState.Success) {
        illustration = <UpgradeTimelineSuccessSvg/>;
        titleText = 'Thank you!';
        helpText = 'Your System Admin has been notified.';
    }

    if (actionState === ActionState.Error) {
        illustration = <UpgradeTimelineErrorSvg/>;
        if (isCurrentUserAdmin) {
            titleText = 'Your license could not be generated';
            helpText = 'Please check the system logs for more information.';
        } else {
            titleText = 'There was an error';
            helpText = 'We weren\'t able to notify the System Admin.';
        }
    }

    return (
        <UpgradeWrapper>
            {illustration}
            <UpgradeContent>
                <UpgradeHeader>
                    <Title>{titleText}</Title>
                    <HelpText>{helpText}</HelpText>
                </UpgradeHeader>
                <Button
                    actionState={actionState}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    isServerTeamEdition={isServerTeamEdition}
                    endUserMainAction={endUserMainAction}
                    adminMainAction={adminMainAction}
                    isCloud={isServerCloud}
                />
                {!isServerCloud && isCurrentUserAdmin && !isServerTeamEdition && actionState === ActionState.Uninitialized && <Footer/> }
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
    isServerTeamEdition: boolean;
    endUserMainAction: HandlerType;
    adminMainAction: HandlerType;
    isCloud: boolean;
}

const Button = (props: ButtonProps) => {
    if (props.actionState === ActionState.Loading) {
        return <Spinner/>;
    }

    if (props.actionState === ActionState.Success) {
        return null;
    }

    if (props.actionState === ActionState.Error) {
        if (props.isCurrentUserAdmin) {
            return (
                <PrimaryButton
                    onClick={() => window.open('https://mattermost.com/support/')}
                >
                    {'Contact support'}
                </PrimaryButton>
            );
        }
        return null;
    }

    if (props.isCurrentUserAdmin && props.isServerTeamEdition) {
        return null;
    }

    let buttonText = 'Notify System Admin';
    let handleClick : HandlerType = props.endUserMainAction;

    if (props.isCurrentUserAdmin) {
        handleClick = props.adminMainAction;
        buttonText = props.isCloud ? 'Upgrade now' : 'Start trial';
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
    flex-direction: column;
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
