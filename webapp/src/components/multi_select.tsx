// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled from 'styled-components';

import {CheckboxContainer} from 'src/components/checklist_item/checklist_item';
import {useClickOutsideRef, useKeyPress} from 'src/hooks';

export interface SelectOption{
    display: String;
    value: any;
    selected: boolean;
    disabled: boolean;
}

const FilterCheckboxContainer = styled(CheckboxContainer)`
    margin: 0 34px 0 20px;
    line-height: 30px;
    align-items: center;
    cursor: pointer;

    input[type='checkbox'] {
        width: 16px;
        min-width: 16px;
        height: 16px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
        border-radius: 2px;
    }

    input[type="checkbox"]:checked:disabled {
        background: rgba(var(--button-bg-rgb), 0.24);
        border: 1px solid rgba(var(--button-bg-rgb), 0.24);
    }

`;

const Container = styled.div`
    padding: 100px;
`;

const Dropdown = styled.div`
    display: flex;
    flex-direction: column;

    position: absolute;

    min-width: 160px;
    text-align: left;
    list-style: none;

    padding: 10px 0;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);

    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

    z-index: 1;
`;

const Divider = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.16);
    height: 1px;
    margin: 8px 0;
`;

interface Props{
    target: JSX.Element;
    options: SelectOption[];
    onChange?: (options: SelectOption[], lastAction: SelectOption) => void;
    isOpenChange?: (isOpen: boolean) => void;
}

export const MultiSelect = (props: Props) => {
    const [isOpen, setOpen] = useState(false);

    const setIsOpen = (open: boolean) => {
        setOpen(open);
        if (props.isOpenChange) {
            props.isOpenChange(open);
        }
    };

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    const rootRef = useRef<HTMLDivElement>(null);
    useClickOutsideRef(rootRef, () => {
        setIsOpen(false);
    });

    useKeyPress('Escape', () => {
        setIsOpen(false);
    });

    const onSelect = (value:any, checked:boolean) => {
        const opts = props.options.map((opt) =>
            (opt.value === value && !opt.disabled ? {
                ...opt,
                selected: checked,
            } : {...opt}),
        );

        if (props.onChange) {
            props.onChange(opts, opts.filter((op) => op.value === value)[0]);
        }
    };

    return (
        <Container ref={rootRef} >
            <span onClick={toggleOpen} >{props.target}</span>
            {
                isOpen &&
                <Dropdown>
                    {props.options.map((option) => {
                        if (option.value === 'divider') {
                            return <Divider/>;
                        }

                        return (
                            <FilterCheckboxContainer
                                key={option.value}
                                onClick={() => onSelect(option.value, !option.selected)}
                            >

                                <input
                                    type='checkbox'
                                    checked={option.selected}
                                    disabled={option.disabled}
                                />
                                <span>{option.display}</span>
                            </FilterCheckboxContainer>);
                    })}
                </Dropdown>
            }
        </Container>
    );
};
