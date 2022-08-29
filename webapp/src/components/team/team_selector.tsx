// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import styled, {css} from 'styled-components';
import {Team} from '@mattermost/types/teams';

import Dropdown from 'src/components/dropdown';

import {PlaybookRunFilterButton} from '../backstage/styles';

import TeamWithIcon from './team_with_icon';

export interface Option {
    value: string;
    label: JSX.Element | string;
    teamId: string;
}

interface ActionObj {
    action: ActionTypes;
}

interface Props {
    testId?: string
    selectedTeamId?: string;
    placeholder: React.ReactNode;
    placeholderButtonClass?: string;
    onlyPlaceholder?: boolean;
    enableEdit: boolean;
    isClearable?: boolean;
    customControl?: (props: ControlProps<Option, boolean>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    teams: Team[];
    onSelectedChange?: (teamId: string) => void;
    customControlProps?: any;
    showOnRight?: boolean;
    containerStyles?: ReturnType<typeof css>;
}

const RightAlign = styled.div`
	flex-grow: 1;
	text-align: right;
`;

export default function TeamSelector(props: Props) {
    const {formatMessage} = useIntl();
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        if (!isOpen) {
            updateTeamOptions();
        }
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

    const [teamOptions, setTeamOptions] = useState<Option[]>([]);

    function updateTeamOptions() {
        const optionList = props.teams.map((team: Team) => {
            return ({
                value: team.display_name,
                label: (
                    <TeamWithIcon
                        team={team}
                        showNotLicensedIcon={false}
                    />
                ),
                teamId: team.id,
            } as Option);
        });

        setTeamOptions(optionList);
    }

    // Fill in the userOptions on mount.
    useEffect(() => {
        updateTeamOptions();
    }, []);

    const [selected, setSelected] = useState<Option | null>(null);

    function getTeam(teamId: string) {
        return props.teams.filter((team) => team.id === teamId)[0];
    }

    // Whenever the selectedTeamId changes we have to set the selected, but we can only do this once we
    // have TeamOptions
    useEffect(() => {
        if (teamOptions === []) {
            return;
        }

        const team = teamOptions.find((option: Option) => option.teamId === props.selectedTeamId);
        if (team) {
            setSelected(team);
        } else {
            setSelected(null);
        }
    }, [teamOptions, props.selectedTeamId]);

    const onSelectedChange = async (value: Option | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }
        toggleOpen();
        if (value?.teamId === selected?.teamId) {
            return;
        }
        if (props.onSelectedChange) {
            props.onSelectedChange(value?.teamId || '');
        }
    };

    let target;
    if (props.selectedTeamId) {
        target = (
            <SelectedButton
                data-testid={props.testId}
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
            >
                <TeamWithIcon
                    team={getTeam(props.selectedTeamId)}
                    showNotLicensedIcon={false}
                />

                <RightAlign>
                    {<i className='icon-chevron-down ml-1 mr-2'/>}
                </RightAlign>
            </SelectedButton>
        );
    } else if (props.placeholderButtonClass) {
        target = (
            <button
                data-testid={props.testId}
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
                className={props.placeholderButtonClass}
            >
                {selected === null ? props.placeholder : selected.label}
                <RightAlign>
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </RightAlign>
            </button>
        );
    } else {
        target = (
            <PlaybookRunFilterButton
                data-testid={props.testId}
                active={isOpen}
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
            >
                {selected === null ? props.placeholder : selected.label}
                <RightAlign>
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </RightAlign>
            </PlaybookRunFilterButton>
        );
    }

    if (props.onlyPlaceholder) {
        target = (
            <div
                data-testid={props.testId}
                onClick={toggleOpen}
            >
                {props.placeholder}
            </div>
        );
    }

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setOpen}
            target={target}
            portal={false}
            containerStyles={props.containerStyles}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={teamOptions}
                placeholder={formatMessage({defaultMessage: 'Search'})}
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
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export const SelectedButton = styled.button`
    font-weight: 600;
    height: 40px;
    padding: 0 4px 0 12px;
    border-radius: 4px;
    color: var(--center-channel-color);
    transition: all 0.15s ease;

    border: none;
    background-color: unset;
    display: flex;
    align-items: center;
    text-align: center;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    .PlaybookRunProfile {
        &:active {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }

        &.active {
            cursor: pointer;
            color: var(--center-channel-color);
        }
    }


    .NoAssignee-button, .Assigned-button {
        background-color: transparent;
        border: none;
        padding: 4px;
        margin-top: 4px;
        border-radius: 100px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        font-weight: normal;
        font-size: 12px;
        line-height: 16px;

        -webkit-transition: all 0.15s ease;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &:active {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }

        &.active {
            cursor: pointer;
        }

        .icon-chevron-down {
            &:before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        margin-top: 0;
        padding: 2px 0;
        font-size: 14px;
        line-height: 20px;
        color: var(--center-channel-color);
    }
`;
