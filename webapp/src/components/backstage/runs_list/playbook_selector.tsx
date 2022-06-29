// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import styled from 'styled-components';

import {useClientRect} from 'src/hooks';
import {PlaybookRunFilterButton} from '../../backstage/styles';
import {Playbook} from '../../../types/playbook';
import {SelectedButton} from 'src/components/team/team_selector';
import Dropdown from 'src/components/dropdown';

export interface Option {
    value: string;
    label: JSX.Element | string;
    playbookId: string;
}

interface ActionObj {
    action: ActionTypes;
}

interface Props {
    testId?: string
    selectedPlaybookId?: string;
    placeholder: React.ReactNode;
    enableEdit: boolean;
    isClearable?: boolean;
    customControl?: (props: ControlProps<Option, boolean>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    getPlaybooks: () => Promise<Playbook[]>;
    onSelectedChange?: (playbookId?: string) => void;
    customControlProps?: any;
    className?: string;
}

export default function PlaybookSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const [playbookOptions, setPlaybookOptions] = useState<Option[]>([]);

    async function fetchPlaybooks() {
        const playbooks = await props.getPlaybooks();
        const optionList = playbooks.map((playbook: Playbook) => {
            return ({
                value: playbook.title,
                label: playbook.title,
                playbookId: playbook.id,
            } as Option);
        });

        setPlaybookOptions(optionList);
    }

    // Fill in the playbookOptions on mount.
    useEffect(() => {
        fetchPlaybooks();
    }, []);

    const [selected, setSelected] = useState<Option | null>(null);

    // Whenever the selectedPlaybookId changes we have to set the selected, but we can only do this once we
    // have playbookOptions
    useEffect(() => {
        if (playbookOptions === []) {
            return;
        }

        const playbook = playbookOptions.find((option: Option) => option.playbookId === props.selectedPlaybookId);
        if (playbook) {
            setSelected(playbook);
        } else {
            setSelected(null);
        }
    }, [playbookOptions, props.selectedPlaybookId]);

    const onSelectedChange = async (value: Option | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }
        toggleOpen();
        if (value?.playbookId === selected?.playbookId) {
            return;
        }
        if (props.onSelectedChange) {
            props.onSelectedChange(value?.playbookId);
        }
    };

    // Decide where to open the profile selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        if (!rect) {
            setMoveUp(0);
            return;
        }

        const innerHeight = window.innerHeight;
        const numPlaybooksShown = Math.min(6, playbookOptions.length);
        const spacePerPlaybook = 48;
        const dropdownYShift = 27;
        const dropdownReqSpace = 80;
        const extraSpace = 10;
        const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numPlaybooksShown * spacePerPlaybook) + extraSpace;
        setMoveUp(Math.max(0, dropdownBottom - innerHeight));
    }, [rect, playbookOptions.length]);

    let target;
    if (props.selectedPlaybookId) {
        const playbookOption = playbookOptions.find((option) => option.playbookId === props.selectedPlaybookId);
        target = (
            <SelectedButton onClick={props.enableEdit ? toggleOpen : () => null}>
                <StyledSpan>
                    {playbookOption?.value}
                </StyledSpan>
                <i className='icon-chevron-down ml-1 mr-2'/>
            </SelectedButton>
        );
    } else {
        target = (
            <PlaybookRunFilterButton
                active={isOpen}
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
            >
                {selected === null ? props.placeholder : selected.label}
                {<i className='icon-chevron-down icon--small ml-2'/>}
            </PlaybookRunFilterButton>
        );
    }

    const targetWrapped = (
        <div
            data-testid={props.testId}
            ref={ref}
            className={props.className}
        >
            {target}
        </div>
    );

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={targetWrapped}
            moveUp={moveUp}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={playbookOptions}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option, action) => onSelectedChange(option as Option, action as ActionObj)}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
                {...props.customControlProps}
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles: StylesConfig<Option, boolean> = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(var(--sys-mention-color-rgb), 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

const StyledSpan = styled.span`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
`;

