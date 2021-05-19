import React from 'react';

import moment from 'moment';

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

export const getUpgradeModalButtons = (isAdmin: boolean, isServerTeamEdition: boolean, state: ModalActionState, requestLicense: () => void, notifyAdmins: () => void, onHide: () => void) : UpgradeModalButtons => {
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
            return {
                confirmButtonText: 'Start trial',
                cancelButtonText: 'Not right now',
                handleConfirm: requestLicense,
                handleCancel: onHide,
            };
        }
        return {
            confirmButtonText: 'Notify System Admin',
            cancelButtonText: 'Not right now',
            handleConfirm: notifyAdmins,
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

    default:
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
            const expiryDate = moment().add('days', 30).format('MMMM D, YYYY');
            return {
                titleText: 'Your 30-day trial has started',
                helpText: (
                    <span>
                        {`Your Enterprise E10 license expires on ${expiryDate}. You can purchase a license at any time through the `}
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
            titleText = 'Playbook limit reached';
            helpText = 'Every incident is different. With multiple playbooks each incident\'s workflow can be refined over time to improve time to resolution.';
            break;
        case AdminNotificationType.VIEW_TIMELINE:
        case AdminNotificationType.MESSAGE_TO_TIMELINE:
            titleText = 'Add more to your timeline';
            helpText = 'Add important messages from the incident channel to the timeline and improve context in your retrospective.';
            break;
        case AdminNotificationType.PLAYBOOK_GRANULAR_ACCESS:
            titleText = 'Put your team in control';
            helpText = 'Use permissions to manage who can view, modify, and create incidents from this playbook.';
            break;
        case AdminNotificationType.PLAYBOOK_CREATION_RESTRICTION:
            titleText = 'Put your team in control';
            helpText = 'Every team\'s structure is different. You can manage which users in the team can create playbooks.';
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
        return {
            titleText: 'There was an error',
            helpText: '',
        };
    }
};
