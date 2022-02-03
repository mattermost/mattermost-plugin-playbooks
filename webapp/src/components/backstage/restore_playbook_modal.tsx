import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {restorePlaybook} from 'src/client';
import {Banner} from 'src/components/backstage/styles';
import {Playbook} from 'src/types/playbook';
import ConfirmModal from '../widgets/confirmation_modal';

const RestoreBannerTimeout = 5000;

const useConfirmPlaybookRestoreModal = (): [React.ReactNode, (pb: Playbook) => void] => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);

    const openModal = (playbookToOpenWith: Playbook) => {
        setPlaybook(playbookToOpenWith);
        setOpen(true);
    };

    async function onRestore() {
        if (playbook) {
            await restorePlaybook(playbook.id);

            setOpen(false);
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
            }, RestoreBannerTimeout);
        }
    }

    const modal = (
        <>
            <ConfirmModal
                show={open}
                onConfirm={onRestore}
                onCancel={() => setOpen(false)}
                title={formatMessage({defaultMessage: 'Restore playbook'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to restore the playbook {title}?'}, {title: playbook?.title})}
                confirmButtonText={formatMessage({defaultMessage: 'Restore'})}

            />
            {showBanner &&
                <Banner>
                    <i className='icon icon-check mr-1'/>
                    <FormattedMessage
                        defaultMessage='The playbook {title} was successfully restored.'
                        values={{title: playbook?.title}}
                    />
                </Banner>
            }
        </>
    );

    return [modal, openModal];
};

export default useConfirmPlaybookRestoreModal;
