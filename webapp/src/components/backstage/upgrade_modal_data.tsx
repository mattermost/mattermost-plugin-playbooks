import React from 'react';

import {DateTime} from 'luxon';

import ConvertEnterpriseNotice from 'src/components/backstage/convert_enterprise_notice';

import Spinner from 'src/components/assets/icons/spinner';

import {AdminNotificationType} from 'src/constants';

type HandlerType = undefined | (() => (Promise<void> | void));

export interface ModalContents {
    titleText: string;
    helpText: React.ReactNode;
}

export enum ModalActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}

export interface UpgradeModalButtons {
    confirmButtonText : React.ReactNode;
    cancelButtonText : React.ReactNode;
    handleConfirm : HandlerType;
    handleCancel : HandlerType;
}

export const getUpgradeModalButtons = (isAdmin: boolean, isServerTeamEdition: boolean, isCloud: boolean, state: ModalActionState, adminMainAction: () => void, endUserMainAction: () => void, onHide: () => void) : UpgradeModalButtons => {
    if (isServerTeamEdition && isAdmin) {
        return {
            confirmButtonText: '',
            cancelButtonText: '',
            // eslint-disable-next-line no-undefined
            handleConfirm: undefined,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };
    }

    switch (state) {
    case ModalActionState.Uninitialized:
        if (isAdmin) {
            const confirmButtonText = isCloud ? 'Upgrade now' : 'Start trial';

            return {
                confirmButtonText,
                cancelButtonText: 'Not right now',
                handleConfirm: adminMainAction,
                handleCancel: onHide,
            };
        }
        return {
            confirmButtonText: 'Notify System Admin',
            cancelButtonText: 'Not right now',
            handleConfirm: endUserMainAction,
            handleCancel: onHide,
        };

    case ModalActionState.Loading:
        return {
            confirmButtonText: '',
            cancelButtonText: <Spinner/>,
            // eslint-disable-next-line no-undefined
            handleConfirm: undefined,
            handleCancel: () => { /*do nothing*/ },
        };

    case ModalActionState.Success:
        return {
            confirmButtonText: 'Done',
            cancelButtonText: '',
            handleConfirm: onHide,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };

    default:
        if (isAdmin) {
            return {
                confirmButtonText: 'Contact support',
                cancelButtonText: '',
                handleConfirm: () => {
                    window.open('https://mattermost.com/support/');
                },
                // eslint-disable-next-line no-undefined
                handleCancel: undefined,
            };
        }

        return {
            confirmButtonText: 'Done',
            cancelButtonText: '',
            handleConfirm: onHide,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };
    }
};

export const getUpgradeModalCopy = (
    isAdmin: boolean,
    isServerTeamEdition: boolean,
    state: ModalActionState,
    messageType: AdminNotificationType,
) : ModalContents => {
    let titleText = '';
    let helpText : React.ReactNode = '';

    switch (state) {
    case ModalActionState.Success:
        if (isAdmin) {
            const expiryDate = DateTime.now().plus({days: 30}).toLocaleString(DateTime.DATE_FULL);
            return {
                titleText: 'Your 30-day trial has started',
                helpText: (
                    <span>
                        {`Your trial license expires on ${expiryDate}. You can purchase a license at any time through the `}
                        <a
                            href='https://customers.mattermost.com/signup'
                            target={'_blank'}
                            rel='noreferrer'
                        >{'Customer Portal'}</a>
                        {' to avoid any disruption.'}
                    </span>
                ),
            };
        }

        return {
            titleText: 'Thank you!',
            helpText: 'Your System Admin has been notified',
        };

    case ModalActionState.Uninitialized:
    case ModalActionState.Loading:
        switch (messageType) {
        case AdminNotificationType.PLAYBOOK:
            titleText = 'A playbook for every process';
            helpText = 'Your subscription allows one playbook per team. Upgrade your subscription and create multiple playbooks with unique workflows for each team.';
            break;
        case AdminNotificationType.VIEW_TIMELINE:
        case AdminNotificationType.MESSAGE_TO_TIMELINE:
            titleText = 'Add more to your timeline';
            helpText = 'Save important messages for a complete picture that streamlines retrospectives.';
            break;
        case AdminNotificationType.PLAYBOOK_GRANULAR_ACCESS:
            titleText = 'Put your team in control';
            helpText = 'Manage permission for who can view, modify, and run this playbook.';
            break;
        case AdminNotificationType.PLAYBOOK_CREATION_RESTRICTION:
            titleText = 'Put your team in control';
            helpText = 'Every team\'s structure is different. You can manage which users in the team can create playbooks.';
            break;
        case AdminNotificationType.EXPORT_CHANNEL:
            titleText = 'Save your playbook run history';
            helpText = 'Export the channel of your playbook run and save it for later analysis.';
            break;
        }

        if (!isAdmin) {
            helpText += ' Notify your System Admin to upgrade.';
        } else if (isServerTeamEdition) {
            helpText = (
                <>
                    <p>{helpText}</p>
                    <ConvertEnterpriseNotice/>
                </>
            );
        }

        return {
            titleText,
            helpText,
        };
    default:
        if (isAdmin) {
            titleText = 'Your license could not be generated';
            helpText = 'Please check the system logs for more information.';
        } else {
            titleText = 'There was an error';
            helpText = 'We weren\'t able to notify the System Admin.';
        }

        return {
            titleText,
            helpText,
        };
    }
};
