// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

export type BetaFeaturesValue = {
    task_requirements?: boolean;
};

type Props = {
    id: string;
    value?: BetaFeaturesValue | null;
    disabled?: boolean;
    onChange: (id: string, value: BetaFeaturesValue) => void;
    setSaveNeeded: () => void;
};

const defaultValue: BetaFeaturesValue = {
    task_requirements: false,
};

const BetaFeaturesSetting = ({id, value, disabled, onChange, setSaveNeeded}: Props) => {
    const {formatMessage} = useIntl();
    const [expanded, setExpanded] = useState(false);

    const features = useMemo(() => ({
        ...defaultValue,
        ...(value || {}),
    }), [value]);

    const enabledCount = Object.values(features).filter(Boolean).length;

    const toggleFeature = (key: keyof BetaFeaturesValue) => {
        if (disabled) {
            return;
        }
        const next = {
            ...features,
            [key]: !features[key],
        };
        onChange(id, next);
        setSaveNeeded();
    };

    return (
        <Accordion data-testid='beta-features-accordion'>
            <AccordionHeader
                type='button'
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                disabled={disabled}
            >
                <HeaderLeft>
                    <Chevron className={`icon ${expanded ? 'icon-chevron-down' : 'icon-chevron-right'}`}/>
                    <HeaderText>
                        <Title>
                            {formatMessage({defaultMessage: 'Beta Features'})}
                        </Title>
                        <Subtitle>
                            {formatMessage({defaultMessage: 'Opt-in features that are still being refined and may change.'})}
                        </Subtitle>
                    </HeaderText>
                </HeaderLeft>
                <Badge>
                    {enabledCount === 0 ? formatMessage({defaultMessage: 'None enabled'}) : formatMessage(
                        {defaultMessage: '{count} enabled'},
                        {count: enabledCount},
                    )}
                </Badge>
            </AccordionHeader>
            {expanded && (
                <AccordionBody>
                    <FeatureRow>
                        <CheckboxLabel>
                            <Checkbox
                                type='checkbox'
                                checked={Boolean(features.task_requirements)}
                                disabled={disabled}
                                onChange={() => toggleFeature('task_requirements')}
                                data-testid='beta-feature-task-requirements'
                            />
                            <FeatureCopy>
                                <FeatureName>
                                    {formatMessage({defaultMessage: 'Task requirements'})}
                                </FeatureName>
                                <FeatureHelp>
                                    {formatMessage({defaultMessage: 'Require users to fill in labeled fields when checking off a task.'})}
                                </FeatureHelp>
                            </FeatureCopy>
                        </CheckboxLabel>
                    </FeatureRow>
                </AccordionBody>
            )}
        </Accordion>
    );
};

const Accordion = styled.div`
    width: 100%;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    background: var(--center-channel-bg);
    overflow: hidden;
`;

const AccordionHeader = styled.button`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    border: none;
    background: transparent;
    color: var(--center-channel-color);
    cursor: pointer;
    text-align: left;

    &:disabled {
        cursor: default;
        opacity: 0.64;
    }

    &:not(:disabled):hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const HeaderLeft = styled.div`
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 8px;
`;

const Chevron = styled.i`
    margin-top: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 16px;
`;

const HeaderText = styled.div`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
`;

const Title = styled.div`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const Subtitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
`;

const Badge = styled.div`
    flex-shrink: 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    white-space: nowrap;
`;

const AccordionBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 20px 16px 44px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FeatureRow = styled.div`
    padding-top: 12px;
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    cursor: pointer;
    font-weight: normal;
`;

const Checkbox = styled.input`
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    accent-color: var(--button-bg);
    cursor: pointer;

    &:disabled {
        cursor: default;
    }
`;

const FeatureCopy = styled.div`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
`;

const FeatureName = styled.div`
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const FeatureHelp = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    line-height: 16px;
`;

export default BetaFeaturesSetting;
