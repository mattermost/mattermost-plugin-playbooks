// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {TaskRequirement} from 'src/types/playbook';

type Props = {
    requirements: TaskRequirement[];
    /** When true, show labels only (playbook editor). When false, show filled values (run). */
    editMode?: boolean;
    isTaskComplete?: boolean;
    /** Shown on runs when values can be edited. */
    onEditValues?: () => void;
    /** Shown on runs when the task is not yet complete. */
    onComplete?: () => void;
    readOnly?: boolean;
};

const RequirementsAccordion = ({
    requirements,
    editMode,
    isTaskComplete,
    onEditValues,
    onComplete,
    readOnly,
}: Props) => {
    const {formatMessage} = useIntl();
    const [expanded, setExpanded] = useState(false);

    if (!requirements?.length) {
        return null;
    }

    const filledCount = requirements.filter((r) => (r.value || '').trim() !== '').length;
    const showValues = !editMode && filledCount > 0;

    const headerLabel = editMode ? formatMessage(
        {defaultMessage: '{count, plural, one {# requirement} other {# requirements}}'},
        {count: requirements.length},
    ) : showValues ? formatMessage(
        {defaultMessage: '{count, plural, one {# required field} other {# required fields}}'},
        {count: requirements.length},
    ) : formatMessage(
        {defaultMessage: '{count, plural, one {# requirement} other {# requirements}}'},
        {count: requirements.length},
    );

    return (
        <Container data-testid='task-requirements-accordion'>
            <HeaderRow>
                <Header
                    type='button'
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                >
                    <Chevron className={`icon ${expanded ? 'icon-chevron-down' : 'icon-chevron-right'}`}/>
                    <HeaderText>{headerLabel}</HeaderText>
                </Header>
                {!editMode && !readOnly && (
                    <Actions>
                        {!isTaskComplete && !showValues && onComplete && (
                            <ActionButton
                                type='button'
                                onClick={onComplete}
                                data-testid='complete-requirement-values'
                            >
                                {formatMessage({defaultMessage: 'Complete'})}
                            </ActionButton>
                        )}
                        {onEditValues && (showValues || isTaskComplete) && (
                            <ActionButton
                                type='button'
                                onClick={onEditValues}
                                data-testid='edit-requirement-values'
                            >
                                {formatMessage({defaultMessage: 'Edit'})}
                            </ActionButton>
                        )}
                    </Actions>
                )}
            </HeaderRow>
            {expanded && (
                <Body>
                    {requirements.map((req) => (
                        <Field key={req.id}>
                            <ReqLabel>{req.label}</ReqLabel>
                            {showValues || (!editMode && (req.value || '').trim() !== '') ? (
                                <ReqValue>{req.value || '—'}</ReqValue>
                            ) : editMode ? (
                                <Placeholder>
                                    {formatMessage({defaultMessage: 'Text input — filled when the task is checked off'})}
                                </Placeholder>
                            ) : (
                                <Placeholder>
                                    {formatMessage({defaultMessage: 'Not filled yet'})}
                                </Placeholder>
                            )}
                        </Field>
                    ))}
                </Body>
            )}
        </Container>
    );
};

const Container = styled.div`
    margin: 12px 0 4px 36px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
`;

const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 4px;
`;

const Header = styled.button`
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    padding: 6px 8px;
    border: none;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-align: left;

    &:hover {
        color: var(--center-channel-color);
    }
`;

const Chevron = styled.i`
    margin-right: 4px;
    font-size: 12px;
`;

const HeaderText = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Actions = styled.div`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
`;

const ActionButton = styled.button`
    flex-shrink: 0;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--button-bg);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 12px 12px 28px;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const ReqLabel = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const ReqValue = styled.div`
    min-height: 32px;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 13px;
    font-weight: 400;
    line-height: 18px;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
`;

const Placeholder = styled.div`
    min-height: 32px;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px dashed rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 12px;
    font-style: italic;
    line-height: 18px;
`;

export default RequirementsAccordion;
