// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {OptionTypeBase, StylesConfig} from 'react-select';

import CreatableSelect from 'react-select/creatable';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled: boolean;
    textOnToggle: string;
    onToggle: () => void;
    placeholderText: string;
    keywords: string[];
    onKeywordsChange: (keywords: string[]) => void;
}

const selectComponents = {
    DropdownIndicator: null,
    ClearIndicator: null,
};

const createOption = (label: string) => ({
    label,
    value: label,
});

export const InputKeywords = (props: Props) => {
    const [inputValue, setInputValue] = useState('');
    const [values, setValues] = useState(props.keywords.map(createOption));

    const handleChange = (value: any) => {
        let newValues: {label: string, value: string}[] = value;
        if (!value) {
            newValues = [];
        }
        setValues(newValues);
        props.onKeywordsChange(newValues.map((item) => item.value));
    };

    const handleInputChange = (newInputValue: string) => {
        setInputValue(newInputValue);
    };

    const handleInput = (isBlur: boolean, event: any) => {
        if (!inputValue) {
            return;
        }

        if (isBlur || event.key === 'Enter' || event.key === 'Tab') {
            const keywords = values.map((item) => item.value);
            if (keywords.includes(inputValue)) {
                return;
            }
            setInputValue('');
            setValues([...values, createOption(inputValue)]);
            event.preventDefault();
            props.onKeywordsChange([...keywords, inputValue]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        handleInput(false, e);
    };

    const handleBlur = (e: React.FocusEvent) => {
        handleInput(true, e);
    };

    return (
        <KeywordsAutomationHeader>
            <KeywordsAutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div>{props.textOnToggle}</div>
            </KeywordsAutomationTitle>
            <KeywordsSelectorWrapper>
                <CreatableSelect
                    components={selectComponents}
                    isDisabled={!props.enabled}
                    inputValue={inputValue}
                    isClearable={true}
                    isMulti={true}
                    menuIsOpen={false}
                    placeholder={props.placeholderText}
                    value={props.enabled ? values : []}
                    onKeyDown={handleKeyDown}
                    onChange={handleChange}
                    onInputChange={handleInputChange}
                    onBlur={handleBlur}
                    styles={selectStyles}
                />
            </KeywordsSelectorWrapper>
        </KeywordsAutomationHeader>
    );
};

// styles for the select component
const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '10px',
        paddingLeft: '8px',
        overflow: 'hidden',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '13px',
        height: '13px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '13px',
            width: '13px',
        },
    }),
};

const KeywordsAutomationHeader = styled(AutomationHeader)`
    align-items: flex-start;
`;

const KeywordsAutomationTitle = styled(AutomationTitle)`
    margin: 8px 0px 8px 0px;
`;

const KeywordsSelectorWrapper = styled(SelectorWrapper)`
    height: 100%;
`;
