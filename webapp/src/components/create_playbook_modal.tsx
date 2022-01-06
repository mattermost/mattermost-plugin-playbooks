import React, {ComponentProps, useState} from 'react';

import {haveITeamPermission} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/roles';
import {getMyTeams} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/teams';
import {GlobalState} from 'mattermost-webapp/packages/mattermost-redux/src/types/store';
import {Team} from 'mattermost-webapp/packages/mattermost-redux/src/types/teams';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {useHasTeamPermission, usePlaybooksRouting} from 'src/hooks';
import {Playbook} from 'src/types/playbook';

import {BaseInput} from './assets/inputs';
import PublicPrivateSelector from './backstage/public_private_selector';
import {TemplateDropdown} from './backstage/template_selector';
import MarkdownTextbox from './markdown_textbox';
import TeamSelector from './team/team_selector';
import GenericModal, {InlineLabel} from './widgets/generic_modal';

const ID = 'playbooks_create';

export const makePlaybookCreateModal = (props: PlaybookCreateModalProps) => ({
    modalId: ID,
    dialogType: PlaybookCreateModal,
    dialogProps: props,
});

export type PlaybookCreateModalProps = {
    startingName?: string
    startingTeamId?: string
    startingTemplate?: string
    startingDescription?: string
    startingPublic?: boolean
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

const TeamSelectorBorder = styled(BaseInput).attrs({as: 'div'})`
	display: flex;
	flex-direction: horizontal;
	padding: 0;
`;

const selectTeamsIHavePermissionToMakePlaybooksOn = (state: GlobalState) => {
    return getMyTeams(state).filter((team: Team) => (
        haveITeamPermission(state, team.id, 'playbook_public_create') ||
		haveITeamPermission(state, team.id, 'playbook_private_create')
    ));
};

const PlaybookCreateModal = ({startingName, startingTeamId, startingTemplate, startingDescription, startingPublic, ...modalProps}: PlaybookCreateModalProps) => {
    const {formatMessage} = useIntl();
    const teams = useSelector(selectTeamsIHavePermissionToMakePlaybooksOn);
    const [name, setName] = useState(startingName);
    const [teamId, setTeamId] = useState<string>(teams.length === 1 ? teams[0].id : (startingTeamId || teams[0].id));
    const [template, setTemplate] = useState(startingTemplate);
    const [description, setDescription] = useState(startingDescription);
    const [makePublic, setMakePublic] = useState(startingPublic ?? true);
    const permissionForPublic = useHasTeamPermission(teamId || '', 'playbook_public_create');
    const permissionForPrivate = useHasTeamPermission(teamId || '', 'playbook_private_create');
    const hasCreationRestrictions = !(permissionForPublic && permissionForPrivate) && Boolean(teamId);
    const makePublicWithPermission = hasCreationRestrictions ? permissionForPublic : makePublic;

    const {create} = usePlaybooksRouting<Playbook>();

    const requirementsMet = (teamId !== '');

    return (
        <SizedGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Playbook'})}
            {...modalProps}
            confirmButtonText={formatMessage({defaultMessage: 'Create playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={!requirementsMet}
            handleConfirm={() => create({teamId, template, name, description, public: makePublicWithPermission})}
            showCancel={true}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
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
                <TeamSelectorBorder>
                    <TeamSelector
                        selectedTeamId={teamId}
                        placeholder={'Select a team'}
                        enableEdit={true}
                        isClearable={false}
                        teams={teams}
                        onSelectedChange={setTeamId}
                    />
                </TeamSelectorBorder>
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
