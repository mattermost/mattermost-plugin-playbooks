// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';

import {FormattedMessage, useIntl} from 'react-intl';

import {useDispatch} from 'react-redux';

import {displayPlaybookCreateModal} from 'src/actions';
import {telemetryEventForTemplate} from 'src/client';

import {StyledSelect} from 'src/components/backstage/styles';

import TemplateItem from './template_item';
import PresetTemplates, {PresetTemplate} from './template_data';

const presetTemplateOptions = PresetTemplates.map((template: PresetTemplate) => ({label: template.title, value: template.title}));

interface Props {
    templates?: PresetTemplate[];
}

export function isPlaybookCreationAllowed(allowPlaybookCreationInTeams: Map<string, boolean>) {
    for (const [key, value] of allowPlaybookCreationInTeams) {
        if (value) {
            return true;
        }
    }
    return false;
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
	/* grid-template-rows: repeat(auto-fill, minmax(256px, 1fr)); */
    grid-gap: min(4vw, 4rem);
    place-items: flex-start center;
    padding: 0 0 100px;
`;

const TemplateSelector = ({templates = PresetTemplates}: Props) => {
    const dispatch = useDispatch();
    return (
        <SelectorGrid>
            {templates.map((template: PresetTemplate) => (
                <TemplateItem
                    key={template.title}
                    label={template.label}
                    title={template.title}
                    description={template.description ?? ''}
                    color={template.color}
                    icon={template.icon}
                    author={template.author}
                    labelColor={template.labelColor}
                    onClick={() => {
                        telemetryEventForTemplate(template.title, 'click_template_icon');
                        dispatch(displayPlaybookCreateModal({startingTemplate: template.title}));
                    }}
                />
            ))}

        </SelectorGrid>
    );
};

export default TemplateSelector;
