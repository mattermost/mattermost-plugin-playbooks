import React, {FC, useState} from 'react';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import moment from 'moment';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import General from 'mattermost-redux/constants/general';

import GenericModal from 'src/components/widgets/generic_modal';
import UpgradeIllustrationSvg from 'src/components/assets/upgrade_illustration_svg';
import Spinner from 'src/components/assets/icons/spinner';
import UpgradeSuccessIllustrationSvg from 'src/components/assets/upgrade_success_illustration_svg';
import {requestTrialLicense, postMessageToAdmins} from 'src/client';
import StartTrialNotice from 'src/components/backstage/start_trial_notice';

import {getAdminAnalytics} from 'src/selectors';

import {AdminNotificationType} from 'src/constants';

interface Props {
    messageType: AdminNotificationType;
    show: boolean
    onHide: () => void;
}

const isSystemAdmin = (roles: string): boolean => {
    const rolesArray = roles.split(' ');
    return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
};

type HandlerType = undefined | (() => (Promise<void> | void));

interface ModalContents {
    illustration: React.ReactNode;
    titleText: string;
    helpText: React.ReactNode;
    confirmButtonText : React.ReactNode;
    cancelButtonText : React.ReactNode;
    handleConfirm : HandlerType;
    handleCancel : HandlerType;
}

enum ModalActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}

const getModalData = (onHide: () => void, requestLicense: HandlerType, notifyAdmins: HandlerType, isAdmin: boolean, state: ModalActionState, messageType: AdminNotificationType) : ModalContents => {
    let titleText = '';
    let helpText = '';

    switch (messageType) {
    case AdminNotificationType.PLAYBOOK:
        titleText = 'Playbook limit reached';
        helpText = 'Every incident is different. With multiple playbooks each incident\'s workflow can be refined over time to improve time to resolution.';
        break;
    case AdminNotificationType.VIEW_TIMELINE:
    case AdminNotificationType.MESSAGE_TO_TIMELINE:
        titleText = 'Add more to your timeline';
        helpText = 'Add important messages from the incident channel to the timeline and improve context in your retrospective.';
        break;
    }

    const CommonModal = {
        illustration: <UpgradeIllustrationSvg/>,
        titleText,
        helpText,
        confirmButtonText: 'Start trial',
        cancelButtonText: 'Not right now',
        handleConfirm: requestLicense,
        handleCancel: onHide,
    };

    const AdminStartModal = {...CommonModal};

    const AdminLoadingModal = Object.assign({...AdminStartModal}, {
        cancelButtonText: <Spinner/>,
        // eslint-disable-next-line no-undefined
        handleConfirm: undefined,
        handleCancel: () => { /*do nothing*/ },
    });

    const AdminErrorModal = Object.assign({...AdminStartModal}, {

    });

    const expiryDate = moment().add('days', 30).format('MMMM D, YYYY');

    const AdminSuccessModal = Object.assign({...AdminStartModal}, {
        illustration: <UpgradeSuccessIllustrationSvg/>,
        titleText: 'Your 30-day trial has started',
        helpText: (
            <span>
                {`Your Enterprise E10 license expires on ${expiryDate}. Purchase a license at anytime through the `}
                <a
                    href='https://customers.mattermost.com/signup'
                    target={'_blank'}
                    rel='noreferrer'
                >{'Customer Portal'}</a>
                {' to avoid any disruption.'}
            </span>
        ),
        confirmButtonText: 'Purchase license now',
        handleConfirm: () => window.open('https://customers.mattermost.com/signup', '_blank'),
    });

    const UserStartModal = Object.assign({...CommonModal}, {
        helpText: helpText + ' Notify your administrator to upgrade.',
        confirmButtonText: 'Notify Administrator',
        handleConfirm: notifyAdmins,
    });

    const UserLoadingModal = Object.assign({...UserStartModal}, {
        cancelButtonText: <Spinner/>,
        // eslint-disable-next-line no-undefined
        handleConfirm: undefined,
        handleCancel: () => { /*do nothing*/ },
    });

    const UserSuccessModal = Object.assign({...UserStartModal}, {
        illustration: <UpgradeSuccessIllustrationSvg/>,
        titleText: 'Thank you!',
        helpText: 'Your System Admin has been notified',
        confirmButtonText: 'Done',
        handleConfirm: onHide,
        // eslint-disable-next-line no-undefined
        handleCancel: undefined,
    });

    if (isAdmin) {
        switch (state) {
        case ModalActionState.Uninitialized:
            return AdminStartModal;
        case ModalActionState.Loading:
            return AdminLoadingModal;
        case ModalActionState.Error:
            return AdminErrorModal;
        case ModalActionState.Success:
            return AdminSuccessModal;
        default:
            return AdminStartModal;
        }
    } else {
        switch (state) {
        case ModalActionState.Uninitialized:
            return UserStartModal;
        case ModalActionState.Loading:
            return UserLoadingModal;
        case ModalActionState.Error:
            return UserStartModal;
        case ModalActionState.Success:
            return UserSuccessModal;
        default:
            return UserStartModal;
        }
    }
};

const UpgradeModal: FC<Props> = (props: Props) => {
    const currentUser = useSelector(getCurrentUser);
    const isCurrentUserAdmin = isSystemAdmin(currentUser.roles);

    const analytics = useSelector(getAdminAnalytics);
    const serverTotalUsers = analytics?.TOTAL_USERS || 0;

    const [actionState, setActionState] = useState(ModalActionState.Uninitialized);

    const requestLicense = async () => {
        if (actionState === ModalActionState.Loading) {
            return;
        }

        setActionState(ModalActionState.Loading);

        const requestedUsers = Math.max(serverTotalUsers, 30);
        const response = await requestTrialLicense(requestedUsers);
        if (response.error) {
            setActionState(ModalActionState.Error);
        } else {
            setActionState(ModalActionState.Success);
        }
    };

    const notifyAdmins = async () => {
        if (actionState === ModalActionState.Loading) {
            return;
        }

        setActionState(ModalActionState.Loading);

        await postMessageToAdmins(props.messageType);
        setActionState(ModalActionState.Success);
    };

    const modalData = getModalData(props.onHide, requestLicense, notifyAdmins, isCurrentUserAdmin, actionState, props.messageType);

    return (
        <SizedGenericModal
            id={'id'}
            show={props.show}
            modalHeaderText={''}
            onHide={props.onHide}
            confirmButtonText={modalData.confirmButtonText}
            cancelButtonText={modalData.cancelButtonText}
            handleCancel={modalData.handleCancel}
            handleConfirm={modalData.handleConfirm}
            autoCloseOnConfirmButton={false}
            footer={(
                <Footer
                    actionState={actionState}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                />
            )}
        >
            <Content>
                <IllustrationWrapper>
                    {modalData.illustration}
                </IllustrationWrapper>
                <Header>
                    <Title>{modalData.titleText}</Title>
                    <HelpText>{modalData.helpText}</HelpText>
                </Header>
            </Content>
        </SizedGenericModal>
    );
};

const FooterContainer = styled.div`
    min-height: 32px;
    width: 362px;
    height: 32px;

    font-size: 11px;
    line-height: 16px;

    display: flex;
    align-items: center;
    text-align: center;

    color: rgba(var(--center-channel-color, 0.56));

    margin-top: 18px;
`;

interface FooterProps {
    actionState: ModalActionState;
    isCurrentUserAdmin: boolean;
}

const Footer : FC<FooterProps> = (props: FooterProps) => {
    if (!props.isCurrentUserAdmin) {
        return null;
    }

    if (props.actionState !== ModalActionState.Uninitialized) {
        return null;
    }

    return (
        <FooterContainer>
            <StartTrialNotice/>
        </FooterContainer>
    );
};

const Content = styled.div`
    display: flex;
    flex-direction: column;
`;

const CenteredRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

const IllustrationWrapper = styled(CenteredRow)`
    height: 156px;
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 20px;
`;

const Title = styled(CenteredRow)`
    display: grid;
    align-content: center;
    height: 32px;
    margin-bottom: 8px;

    font-weight: 600;
    font-size: 24px;
    color: rgba(var(--center-channel-color-rgb), 1);
`;

const HelpText = styled(CenteredRow)`
    display: grid;
    align-content: center;
    text-align: center;
    width: 448px;

    font-weight: 400;
    font-size: 12px;
    color: var(--center-channel-color);
`;

const SizedGenericModal = styled(GenericModal)`
    width: 512px;
    height: 404px;
    padding: 0;

    .GenericModal__header {
        min-height: 48px;
    }

    .modal-content {
        padding: 0;
    }

    &&& .close {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    .GenericModal__button.confirm {
        padding: 13px 20px;
    }

    .modal-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 32px;
        margin-bottom: 48px;
        padding: 0;
    }
`;

export default UpgradeModal;
