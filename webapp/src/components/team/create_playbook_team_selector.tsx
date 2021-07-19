// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactSelect, {StylesConfig} from 'react-select';
import classNames from 'classnames';
import styled from 'styled-components';
import {Team} from 'mattermost-redux/types/teams';

import {PrimaryButton} from 'src/components/assets/buttons';

import {useClientRect} from 'src/hooks';

import TeamWithIcon from './team_with_icon';

interface Option {
    value: string;
    label: JSX.Element | string;
    teamId: string;
}

interface Props {
    testId?: string
    placeholder: React.ReactNode;
    enableEdit: boolean;
    teams: Team[];
    allowPlaybookCreationInTeams: Map<string, boolean>;
    withButton: boolean;
    onSelectedChange: (team: Team) => void;
}

const dropdownYShift = 27;

interface Position {
    x: number;
    y: number
}

export default function CreatePlaybookTeamSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const [position, setPosition] = useState({x: 0, y: 0});
    const toggleOpen = (x: number, y: number) => {
        if (!isOpen) {
            updateTeamOptions();
        }
        setPosition({x, y});
        setOpen(!isOpen);
    };

    const [teamOptions, setTeamOptions] = useState<Option[]>([]);

    function updateTeamOptions() {
        const optionList = props.teams.map((team: Team) => {
            return ({
                value: team.display_name,
                label: (
                    <TeamWithIcon
                        team={team}
                        allowed={Boolean(props.allowPlaybookCreationInTeams.get(team.id))}
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

    function getTeam(teamId: string) {
        return props.teams.filter((team) => team.id === teamId)[0];
    }

    const onSelectedChange = async (value: Option | undefined) => {
        toggleOpen(0, 0);

        const team = getTeam(value?.teamId || '');
        props.onSelectedChange(team);
    };

    // Decide where to open the team selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        if (!rect) {
            setMoveUp(0);
            return;
        }

        const innerHeight = window.innerHeight;
        const numTeamsShown = Math.min(6, teamOptions.length);
        const spacePerProfile = 48;
        const dropdownReqSpace = 80;
        const extraSpace = 10;
        const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numTeamsShown * spacePerProfile) + extraSpace;
        setMoveUp(Math.max(0, dropdownBottom - innerHeight));
    }, [rect, teamOptions.length]);
    let target;
    if (props.withButton) {
        target = (
            <PrimaryButton
                onClick={(event) => {
                    if (props.enableEdit) {
                        toggleOpen(event.clientX, event.clientY);
                    }
                }}
            >
                {props.placeholder}
            </PrimaryButton>
        );
    } else {
        target = (
            <div
                onClick={(event) => {
                    if (props.enableEdit) {
                        toggleOpen(event.clientX, event.clientY);
                    }
                }}
            >
                {props.placeholder}
            </div>
        );
    }

    const targetWrapped = (
        <div
            data-testid={props.testId}
            ref={ref}
        >
            {target}
        </div>
    );

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={() => toggleOpen(0, 0)}
            target={targetWrapped}
            moveUp={moveUp}
            dependsOnMousePosition={!props.withButton}
            position={position}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                menuIsOpen={true}
                options={teamOptions}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                onChange={(option) => onSelectedChange(option as Option)}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles: StylesConfig = {
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

// styled components
interface DropdownProps {
    children: JSX.Element;
    isOpen: boolean;
    showOnRight?: boolean;
    moveUp?: number;
    target: JSX.Element;
    onClose: () => void;
    dependsOnMousePosition: boolean;
    position: Position;
}

const ProfileDropdown = styled.div`
    position: relative;
`;

const Blanket = styled.div`
    bottom: 0;
    left: 0;
    top: 0;
    right: 0;
    position: fixed;
    z-index: 1;
`;

interface ChildContainerProps {
    moveUp?: number
    position?: Position
    dependsOnPosition: boolean;
}

const ChildContainer = styled.div<ChildContainerProps>`
    top: ${(props) => {
        if (props.dependsOnPosition) {
            return props.position ? props.position.y : 0;
        }
        return dropdownYShift - (props.moveUp || 0);
    }}px;
    left: ${(props) => {
        if (props.dependsOnPosition) {
            return props.position ? props.position.x : 0;
        }
        return 0;
    }}px;
    position: ${(props) => (props.dependsOnPosition ? 'fixed' : 'absolute')};
    z-index: 2;
`;

const Dropdown = ({children, isOpen, showOnRight, moveUp, target, onClose, dependsOnMousePosition, position}: DropdownProps) => {
    if (!isOpen) {
        return target;
    }

    const classes = classNames('PlaybookRunFilter', 'profile-dropdown',
        'PlaybookRunFilter--active', 'profile-dropdown--active', {'show-on-right': showOnRight});

    return (
        <ProfileDropdown className={classes}>
            {target}
            <ChildContainer
                className='PlaybookRunFilter-select'
                moveUp={moveUp}
                position={position}
                dependsOnPosition={dependsOnMousePosition}
            >
                {children}
            </ChildContainer>
            <Blanket onClick={onClose}/>
        </ProfileDropdown>
    );
};
