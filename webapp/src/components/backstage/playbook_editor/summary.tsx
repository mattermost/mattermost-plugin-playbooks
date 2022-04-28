// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {savePlaybook} from 'src/client';
import {PlaybookWithChecklist} from 'src/types/playbook';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import TextEdit from 'src/components/text_edit';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
}

const Summary = (props: Props) => {
    const {formatMessage} = useIntl();
    const [playbook, setPlaybook] = useState(props.playbook);

    const updateSummaryForPlaybook = (summary: string) => {
        if (!playbook) {
            return;
        }
        const newPlaybook = {...props.playbook};
        newPlaybook.description = summary;
        setPlaybook(newPlaybook);
        savePlaybook(newPlaybook);
    };

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Summary'})}
        >
            <TextEdit
                placeholder={formatMessage({defaultMessage: 'Add run summary template...'})}
                value={playbook.description}
                onSave={updateSummaryForPlaybook}
            />
        </Section>
    );
};

export default Summary;
