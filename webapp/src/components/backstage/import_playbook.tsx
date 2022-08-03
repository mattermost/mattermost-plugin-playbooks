// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useIntl} from 'react-intl';

import {importFile} from 'src/client';
import {useToaster, ToastType} from 'src/components/backstage/toast_banner';

export const useImportPlaybook = (teamId: string, cb: (id: string) => void) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    const importUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];

            const reader = new FileReader();
            reader.onload = async (ev) => {
                importFile(ev?.target?.result, teamId)
                    .then(({id}) => cb(id))
                    .catch(() => addToast(formatMessage({defaultMessage: 'The playbook import has failed. Please check that JSON is valid and try again.'}), ToastType.Failure));
                e.target.value = '';
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const input = (
        <input
            type='file'
            accept='*.json,application/JSON'
            onChange={importUpload}
            ref={fileInputRef}
            style={{display: 'none'}}
        />
    );
    return [fileInputRef, input] as const;
};
