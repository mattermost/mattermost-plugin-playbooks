// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {StyledComponent} from 'styled-components';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import General from 'mattermost-redux/constants/general';

import Spinner from 'src/components/assets/icons/spinner';
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

interface Props {
    illustration: JSX.Element;
    successIllustration: JSX.Element;
    errorIllustration: JSX.Element;
    titleText: string;
    helpText: string;
    notificationType: AdminNotificationType;
    upgradeWrapperSC: StyledComponent<'div', any>;
    upgradeContentSC: StyledComponent<'div', any>;
    titleSC: StyledComponent<'div', any>;
    helpTextSC: StyledComponent<'div', any>;
    buttonSC: StyledComponent<'button', any>;
    footerContainerSC: StyledComponent<'div', any>;
}

const UpgradeBanner = (props: Props) => {
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

        const response = await postMessageToAdmins(props.notificationType, isServerTeamEdition);
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
        const response = await requestTrialLicense(requestedUsers, props.notificationType);
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

    let illustration = props.illustration;
    let titleText = props.titleText;
    let helpText: React.ReactNode = props.helpText;

    if (isCurrentUserAdmin && isServerTeamEdition) {
        helpText = <><p>{helpText}</p><ConvertEnterpriseNotice/></>;
    }

    if (actionState === ActionState.Success) {
        illustration = props.successIllustration;
        titleText = 'Thank you!';
        helpText = 'Your System Admin has been notified.';
    }

    if (actionState === ActionState.Error) {
        illustration = props.errorIllustration;
        if (isCurrentUserAdmin) {
            titleText = 'Your license could not be generated';
            helpText = 'Please check the system logs for more information.';
        } else {
            titleText = 'There was an error';
            helpText = 'We weren\'t able to notify the System Admin.';
        }
    }

    const UpgradeWrapper = props.upgradeWrapperSC;
    const UpgradeContent = props.upgradeContentSC;
    const Title = props.titleSC;
    const HelpText = props.helpTextSC;

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
                    buttonSC={props.buttonSC}
                />
                {!isServerCloud && isCurrentUserAdmin && !isServerTeamEdition && actionState === ActionState.Uninitialized &&
                <Footer footerContainerSC={props.footerContainerSC}/>}
            </UpgradeContent>
        </UpgradeWrapper>
    );
};

interface FooterProps {
    footerContainerSC: StyledComponent<'div', any>;
}

const Footer = (props: FooterProps) => {
    const FooterContainer = props.footerContainerSC;

    return (
        <FooterContainer>
            <StartTrialNotice/>
        </FooterContainer>
    );
};

interface ButtonProps {
    actionState: ActionState;
    isCurrentUserAdmin: boolean;
    isServerTeamEdition: boolean;
    endUserMainAction: HandlerType;
    adminMainAction: HandlerType;
    isCloud: boolean;
    buttonSC: StyledComponent<'button', any>;
}

const Button = (props: ButtonProps) => {
    const ButtonSC = props.buttonSC;

    if (props.actionState === ActionState.Loading) {
        return <Spinner/>;
    }

    if (props.actionState === ActionState.Success) {
        return null;
    }

    if (props.actionState === ActionState.Error) {
        if (props.isCurrentUserAdmin) {
            return (
                <ButtonSC
                    onClick={() => window.open('https://mattermost.com/support/')}
                >
                    {'Contact support'}
                </ButtonSC>
            );
        }
        return null;
    }

    if (props.isCurrentUserAdmin && props.isServerTeamEdition) {
        return null;
    }

    let buttonText = 'Notify System Admin';
    let handleClick: HandlerType = props.endUserMainAction;

    if (props.isCurrentUserAdmin) {
        handleClick = props.adminMainAction;
        buttonText = props.isCloud ? 'Upgrade now' : 'Start trial';
    }

    return (
        <ButtonSC onClick={handleClick}>
            {buttonText}
        </ButtonSC>
    );
};

const isSystemAdmin = (roles: string): boolean => {
    const rolesArray = roles.split(' ');
    return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
};

const UpgradeHeader = styled.div`
    margin-bottom: 14px;
`;

export default UpgradeBanner;
