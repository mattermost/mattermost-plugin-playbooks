// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';

import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useHasTeamPermission, usePlaybooksRouting} from 'src/hooks';
import {Playbook, DraftPlaybookWithChecklist, emptyPlaybook} from 'src/types/playbook';
import {PlaybookRole} from 'src/types/permissions';
import {savePlaybook} from 'src/client';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {PlaybookLhsDocument} from 'src/graphql/generated/graphql';
import {PresetTemplates} from 'src/components/templates/template_data';
import {navigateToPluginUrl} from 'src/browser_routing';

import {BaseInput} from './assets/inputs';
import PublicPrivateSelector from './backstage/public_private_selector';
import {TemplateDropdown} from './templates/template_selector';
import MarkdownTextbox from './markdown_textbox';
import GenericModal, {InlineLabel} from './widgets/generic_modal';

const ID = 'playbooks_create';

export const makePlaybookCreateModal = (props: PlaybookCreateModalProps) => ({
    modalId: ID,
    dialogType: PlaybookCreateModal,
    dialogProps: props,
});

export type PlaybookCreateModalProps = {
    startingName?: string
    startingTemplate?: string
    startingDescription?: string
    startingPublic?: boolean
    onPlaybookCreated?: (playbookId: string) => void
} & Partial<ComponentProps<typeof GenericModal>>;

const SizedGenericModal = styled(GenericModal)`
    width: 650px;
`;

const Body = styled.div`
	display: flex;
	flex-direction: column;

	& > div, & > input {
		margin-bottom: 24px;
	}
`;

const PlaybookCreateModal = ({startingName, startingTemplate, startingDescription, startingPublic, onPlaybookCreated, ...modalProps}: PlaybookCreateModalProps) => {
    const {formatMessage} = useIntl();
    const [name, setName] = useState(startingName);
    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const [template, setTemplate] = useState(startingTemplate);
    const [description, setDescription] = useState(startingDescription);
    const [makePublic, setMakePublic] = useState(startingPublic ?? true);
    const permissionForPublic = useHasTeamPermission(teamId || '', 'playbook_public_create');
    const permissionForPrivate = useHasTeamPermission(teamId || '', 'playbook_private_create');
    const hasCreationRestrictions = !(permissionForPublic && permissionForPrivate) && Boolean(teamId);
    const makePublicWithPermission = hasCreationRestrictions ? permissionForPublic : makePublic;

    const {create} = usePlaybooksRouting<Playbook>();

    const requirementsMet = (teamId !== '');

    const handleCreate = async () => {
        if (onPlaybookCreated) {
            // When there's a callback, we need to create the playbook directly and return its ID
            const initialPlaybook: DraftPlaybookWithChecklist = {
                ...(PresetTemplates.find((t) => t.title === template)?.template || emptyPlaybook()),
                reminder_timer_default_seconds: 86400,
                members: [{user_id: currentUserId, roles: [PlaybookRole.Member, PlaybookRole.Admin]}],
                team_id: teamId || '',
            };

            if (name) {
                initialPlaybook.title = name;
            }
            if (description) {
                initialPlaybook.description = description;
            }
            if (!initialPlaybook.title) {
                initialPlaybook.title = 'Untitled Playbook';
            }

            initialPlaybook.public = Boolean(makePublicWithPermission);

            const data = await savePlaybook(initialPlaybook);
            getPlaybooksGraphQLClient().refetchQueries({
                include: [PlaybookLhsDocument],
            });

            if (data?.id) {
                // Close this modal first
                modalProps.onHide?.();
                // Then call the callback to open the next modal
                onPlaybookCreated(data.id);
            }
        } else {
            // Normal flow - use the routing function
            await create({teamId, template, name, description, public: makePublicWithPermission});
        }
    };

    return (
        <SizedGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Playbook'})}
            {...modalProps}
            confirmButtonText={formatMessage({defaultMessage: 'Create playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!requirementsMet}
            handleConfirm={handleCreate}
            showCancel={true}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={!onPlaybookCreated}
        >
            <Body>
                <PublicPrivateSelector
                    public={makePublicWithPermission}
                    setPlaybookPublic={setMakePublic}
                    disableOtherOption={hasCreationRestrictions}
                />
                <InlineLabel>{formatMessage({defaultMessage: 'Playbook name'})}</InlineLabel>
                <BaseInput
                    autoFocus={true}
                    type={'text'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <TemplateDropdown
                    template={template}
                    onTemplateSet={setTemplate}
                />
                <MarkdownTextbox
                    value={description}
                    setValue={setDescription}
                    placeholder={formatMessage({defaultMessage: '(Optional) Describe how this playbook should be used'})}
                />
            </Body>
        </SizedGenericModal>
    );
};
