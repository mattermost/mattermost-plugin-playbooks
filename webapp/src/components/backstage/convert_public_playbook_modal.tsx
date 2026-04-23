// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {useEditPlaybook} from 'src/hooks';
import {PlaybookWithChecklist} from 'src/types/playbook';

type ConfirmPlaybookConvertPublicReturn = [React.ReactNode, (show: boolean) => void];
type Props = {
    playbookId: string,
    refetch?: () => void | undefined,
    updater?: (update: Partial<PlaybookWithChecklist>) => void,
}

const useConfirmPlaybookConvertPublicModal = ({playbookId, refetch, updater}: Props): ConfirmPlaybookConvertPublicReturn => {
    const {formatMessage} = useIntl();
    const [showMakePublicConfirm, setShowMakePublicConfirm] = useState(false);
    const [playbook, updatePlaybook] = useEditPlaybook(playbookId, refetch);

    const modal = (
        <ConfirmModal
            show={showMakePublicConfirm}
            title={formatMessage({defaultMessage: 'Convert to public playbook'})}
            message={formatMessage({defaultMessage: 'When you convert to a public playbook, all team members will be able to see and access this playbook and its run history. Are you sure you want to convert {playbookTitle} to a public playbook?'}, {playbookTitle: playbook?.title})}
            confirmButtonText={formatMessage({defaultMessage: 'Convert to public'})}
            isDestructive={true}
            onConfirm={() => {
                if (playbookId && updater) {
                    updater({public: true});
                } else if (playbookId) {
                    updatePlaybook({public: true});
                }
                setShowMakePublicConfirm(false);
            }}
            onCancel={() => setShowMakePublicConfirm(false)}
        />
    );
    return [modal, setShowMakePublicConfirm];
};

export default useConfirmPlaybookConvertPublicModal;
