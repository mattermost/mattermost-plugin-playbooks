// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';

import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import styled from 'styled-components';

import {pluginId} from 'src/manifest';
import GenericModal, {ModalDescription} from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {Textbox} from 'src/webapp_globals';
import {clientFetchPlaybook} from 'src/client';
import {PlaybookWithChecklist} from 'src/types/playbook';

type Props = {
    playbookRunId: PlaybookRun['id'];
    playbookId: PlaybookRun['playbook_id'];
    channelId: PlaybookRun['channel_id'];
}

function UpdateRunStatusModal({playbookRunId, playbookId, channelId, ...modalProps}: Props) {
    const currentTeam = useSelector(getCurrentTeam);
    let playbook: PlaybookWithChecklist | undefined;
    useEffect(() => {
        (async () => {
            playbook = await clientFetchPlaybook(playbookId);
        })();
    });

    const [updateMessage, setUpdateMessage] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    return (
        <GenericModal
            id={'updateRunStatusModal'}
            modalHeaderText={'Post update'}
            confirmButtonText={'Post'}
            cancelButtonText={'Cancel'}
            handleCancel={() => {}}
            handleConfirm={() => {}}
            {...modalProps}
        >
            <FormContainer>

                <ModalDescription>
                    {'This update will be saved to the '}
                    <Link to={`/${currentTeam.name}/${pluginId}/runs/${playbookRunId}`}>{'overview page'}</Link>
                    {playbook?.broadcast_channel_id ? ` and broadcast to ${playbook.broadcast_channel_id}` : ''}

                </ModalDescription>
                <Textbox
                    tabIndex={0}
                    value={updateMessage}
                    emojiEnabled={false}
                    supportsCommands={false}
                    suggestionListPosition='bottom'
                    id='update_run_status_textbox'
                    preview={showPreview}
                    useChannelMentions={false}
                    channelId={channelId}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUpdateMessage(e.target.value)}
                />
                <button onClick={() => setShowPreview(!showPreview)}>
                    {'Preview'}
                </button>
            </FormContainer>

        </GenericModal>

    );
}

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);

    > * {
        margin-bottom: 10px;
    }
`;

export default UpdateRunStatusModal;
export {UpdateRunStatusModal};
