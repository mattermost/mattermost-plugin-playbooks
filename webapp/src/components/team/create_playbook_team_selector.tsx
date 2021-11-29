// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactSelect, {StylesConfig} from 'react-select';
import classNames from 'classnames';
import styled from 'styled-components';
import {Team} from 'mattermost-redux/types/teams';

import {useIntl} from 'react-intl';

import {useDropdownPosition} from 'src/hooks';

import GenericModal from '../widgets/generic_modal';

import TeamWithIcon from './team_with_icon';

interface Option {
    value: Team;
    label: React.ReactNode;
}

interface DropdownPosition {
    x: number;
    y: number;
    isOpen: boolean;
}

export type PlaybookCreateModalProps = {
    testId?: string
    children: React.ReactNode;
    enableEdit: boolean;
    teams: Team[];
    allowPlaybookCreationInTeams: Map<string, boolean>;
    withButton: boolean;
    onSelectedChange: (team: Team) => void;
};

const ID = 'playbooks_create';

export const makePlaybookCreateModal = (props: PlaybookCreateModalProps) => ({
    modalId: ID,
    dialogType: PlaybookCreateModal,
    dialogProps: props,
});

const SizedGenericModal = styled(GenericModal)`
    width: 800px;
`;

const PlaybookCreateModal = (props: PlaybookCreateModalProps) => {
    const {formatMessage} = useIntl();
    const teamOptions = props.teams.map((team: Team) => {
        return ({
            value: team,
            label: (
                <TeamWithIcon
                    team={team}
                    showNotLicensedIcon={!(props.allowPlaybookCreationInTeams.get(team.id))}
                />
            ),
        } as Option);
    });

    const onSelectedChange = async (value: Option | undefined | null | readonly Option[]) => {
        const team = (value as Option).value;
        if (team) {
            props.onSelectedChange(team);
        }
    };

    return null;

    return (
        <SizedGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Playbook'})}
        >
            <ReactSelect
                autoFocus={true}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                backspaceRemovesValue={false}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                menuIsOpen={true}
                options={teamOptions}
                placeholder={formatMessage({defaultMessage: 'Select a team'})}
                styles={selectStyles}
                tabSelectsValue={false}
                onChange={onSelectedChange}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
            />
        </SizedGenericModal>
    );
};

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

// styled components
interface DropdownProps {
    children: React.ReactNode;
    showOnRight?: boolean;
    moveUp?: number;
    target: JSX.Element;
    onClose: () => void;
    dependsOnMousePosition: boolean;
    position: DropdownPosition;
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
    position?: DropdownPosition
    dependsOnPosition: boolean;
}

const ChildContainer = styled.div<ChildContainerProps>`
    margin: 4px 0 0;
    min-width: 20rem;

    top: ${(props) => {
        if (props.dependsOnPosition) {
            return props.position ? props.position.y : 0;
        }
        const dropdownYShift = 40;
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

const Dropdown = ({children, showOnRight, moveUp, target, onClose, dependsOnMousePosition, position}: DropdownProps) => {
    if (!position.isOpen) {
        return target;
    }

    const classes = classNames('PlaybookRunFilter', 'profile-dropdown',
        'PlaybookRunFilter--active', 'profile-dropdown--active', {'show-on-right': showOnRight});

    return (
        <ProfileDropdown className={classes}>
            {target}
            <ChildContainer
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

export default PlaybookCreateModal;
