import React, {useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {restorePlaybook} from 'src/client';
import {Banner} from 'src/components/backstage/styles';
import ConfirmModal from '../widgets/confirmation_modal';

const RestoreBannerTimeout = 5000;

type Props = {id: string; title: string};

const useConfirmPlaybookRestoreModal = (): [React.ReactNode, (playbook: Props, callback?: () => void) => void] => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(false);
    const cbRef = useRef<() => void>();
    const [showBanner, setShowBanner] = useState(false);
    const [playbook, setPlaybook] = useState<Props | null>(null);

    const openModal = (playbookToOpenWith: Props, callback?: () => void) => {
        setPlaybook(playbookToOpenWith);
        setOpen(true);
        cbRef.current = callback;
    };

    async function onRestore() {
        if (playbook) {
            await restorePlaybook(playbook.id);

            setOpen(false);
            setShowBanner(true);
            cbRef.current?.();

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
