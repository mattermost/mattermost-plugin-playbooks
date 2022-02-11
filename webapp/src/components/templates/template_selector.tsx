// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';

import {FormattedMessage, useIntl} from 'react-intl';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useDispatch, useSelector} from 'react-redux';
import {haveITeamPermission} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/roles';
import {getMyTeams} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/teams';
import {GlobalState} from 'mattermost-webapp/packages/mattermost-redux/src/types/store';
import {Team} from 'mattermost-webapp/packages/mattermost-redux/src/types/teams';

import {PlaybookRole} from 'src/types/permissions';
import {navigateToPluginUrl} from 'src/browser_routing';

import {displayPlaybookCreateModal} from 'src/actions';
import {telemetryEventForTemplate, savePlaybook} from 'src/client';

import {StyledSelect} from 'src/components/backstage/styles';
import {usePlaybooksRouting} from 'src/hooks';
import {Playbook, DraftPlaybookWithChecklist, emptyPlaybook} from 'src/types/playbook';

import TemplateItem from './template_item';
import PresetTemplates, {PresetTemplate} from './template_data';

const presetTemplateOptions = PresetTemplates.map((template: PresetTemplate) => ({label: template.title, value: template.title}));

interface Props {
    templates?: PresetTemplate[];
}

interface TemplateDropdownProps {
    template?: string
    onTemplateSet: (template?: string) => void
}

export const TemplateDropdown = (props: TemplateDropdownProps) => {
    const {formatMessage} = useIntl();

    const handleTemplateSet = (option: {value: string}) => {
        props.onTemplateSet(option.value);
    };

    return (
        <StyledSelect
            filterOption={null}
            isMulti={false}
            placeholder={formatMessage({defaultMessage: 'Select a template'})}
            onChange={handleTemplateSet}
            options={presetTemplateOptions}
            value={presetTemplateOptions.find((val) => val.value === props?.template)}
            isClearable={false}
            maxMenuHeight={380}
        />
    );
};

const SelectorGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: min(4vw, 5rem);
    place-items: flex-start center;
    padding: 0 0 100px;
`;

const selectTeamsIHavePermissionToMakePlaybooksOn = (state: GlobalState) => {
    return getMyTeams(state).filter((team: Team) => (
        haveITeamPermission(state, team.id, 'playbook_public_create') ||
		haveITeamPermission(state, team.id, 'playbook_private_create')
    ));
};

const TemplateSelector = ({templates = PresetTemplates}: Props) => {
    const dispatch = useDispatch();
    const {create} = usePlaybooksRouting<Playbook>();
    const teams = useSelector(selectTeamsIHavePermissionToMakePlaybooksOn);
    const currentUserId = useSelector(getCurrentUserId);

    return (
        <SelectorGrid>
            {templates.map((template: PresetTemplate) => {
                let onSelect = () => {
                    telemetryEventForTemplate(template.title, 'click_template_icon');
                    dispatch(displayPlaybookCreateModal({startingTemplate: template.title}));
                };
                if (template.title === 'Learn how to use playbooks') {
                    onSelect = async () => {
                        telemetryEventForTemplate(template.title, 'click_template_icon');
                        const pb:DraftPlaybookWithChecklist = {
                            ...template.template,
                            reminder_timer_default_seconds: 86400,
                            members: [{user_id: currentUserId, roles: [PlaybookRole.Member, PlaybookRole.Admin]}],
                            team_id: teams[0].id || '',
                            public: true,
                        };

                        const data = await savePlaybook(pb);
                        navigateToPluginUrl(`/playbooks/${data?.id}`);
                    };
                }
                return (
                    <TemplateItem
                        key={template.title}
                        label={template.label}
                        title={template.title}
                        description={template.description ?? ''}
                        color={template.color}
                        icon={template.icon}
                        author={template.author}
                        labelColor={template.labelColor}
                        onSelect={onSelect}
                    />);
            })}

        </SelectorGrid>
    );
};

export default TemplateSelector;
