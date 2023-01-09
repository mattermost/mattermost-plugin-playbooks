// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useIntl} from 'react-intl';

import {importFile} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

type FileData = string | ArrayBuffer | null | undefined;

export const useImportPlaybook = (teamId: string, cb: (id: string) => void) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    const errorHandler = () => addToast({
        content: formatMessage({defaultMessage: 'The playbook import has failed. Please check that JSON is valid and try again.'}),
        toastStyle: ToastStyle.Failure,
    });

    const readFile = (file: File) => new Promise<FileData>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result);
        reader.onerror = errorHandler;
        reader.readAsArrayBuffer(file);
    });

    const uploadFile = (data: FileData) => {
        importFile(data, teamId)
            .then(({id}) => cb(id))
            .catch(errorHandler);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) {
            return;
        }
        readFile(e.target.files[0])
            .then((data) => {
                uploadFile(data);
                e.target.value = '';
            });
    };

    const importPlaybookFile = (file: File) => {
        readFile(file)
            .then(uploadFile);
    };

    const input = (
        <input
            type='file'
            accept='*.json,application/JSON'
            onChange={onChange}
            ref={fileInputRef}
            style={{display: 'none'}}
        />
    );
    return [fileInputRef, input, importPlaybookFile] as const;
};
