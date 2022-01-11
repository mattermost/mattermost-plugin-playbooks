import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {archivePlaybook} from 'src/client';
import {Banner} from 'src/components/backstage/styles';
import {Playbook} from 'src/types/playbook';
import ConfirmModal from '../widgets/confirmation_modal';

const ArchiveBannerTimeout = 5000;

const useConfirmPlaybookArchiveModal = (): [React.ReactNode, (pb: Playbook) => void] => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);

    const openModal = (playbookToOpenWith: Playbook) => {
        setPlaybook(playbookToOpenWith);
        setOpen(true);
    };

    const onArchive = async () => {
        if (playbook) {
            await archivePlaybook(playbook.id);

            setOpen(false);
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
            }, ArchiveBannerTimeout);
        }
    };

    const modal = (
        <>
            <ConfirmModal
                show={open}
                title={formatMessage({defaultMessage: 'Delete playbook'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to delete the playbook {title}?'}, {title: playbook?.title})}
                confirmButtonText={formatMessage({defaultMessage: 'Delete'})}
                onConfirm={onArchive}
                onCancel={() => setOpen(false)}
            />
            {showBanner &&
            <Banner>
                <i className='icon icon-check mr-1'/>
                <FormattedMessage
                    defaultMessage='The playbook {title} was successfully archived.'
                    values={{title: playbook?.title}}
                />
            </Banner>
            }
        </>
    );

    return [modal, openModal];
};

export default useConfirmPlaybookArchiveModal;
