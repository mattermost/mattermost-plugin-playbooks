import React, {FC, useState} from 'react';

import {useSelector} from 'react-redux';
import {getMyTeams, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {OptionsType} from 'react-select';

import {Team} from 'mattermost-redux/types/teams';

import {GlobalState} from 'mattermost-redux/types/store';

import {StyledAsyncSelect, RadioContainer, RadioLabel, RadioInput} from './components/backstage/styles';

interface TeamSelectorProps {
    teamsSlected: string[]
    onTeamsSelected: (teams: string[]) => void;
}

type GetTeamType = (teamID: string) => Team

const TeamSelector: FC<TeamSelectorProps> = (props: TeamSelectorProps) => {
    const selectableTeams = useSelector<GlobalState, Team[]>(getMyTeams);
    const getTeamFromID = useSelector<GlobalState, GetTeamType>((state) => (teamId) => getTeam(state, teamId) || {display_name: 'Unknown Team', id: teamId});
    const [enabled, setEnabled] = useState(Boolean(props.teamsSlected) && props.teamsSlected.length !== 0);

    const onChange = (teams: Team[] | null) => {
        if (!teams) {
            props.onTeamsSelected([]);
            return;
        }
        props.onTeamsSelected(teams.map((team: Team) => team.id));
    };

    const getOptionValue = (team: Team) => {
        return team.id;
    };

    const formatOptionLabel = (team: Team) => {
        return (
            <>
                {team.display_name}
            </>
        );
    };

    const loadTeams = (term: string, callback: (options: OptionsType<Team>) => void) => {
        if (term.trim().length === 0) {
            callback(selectableTeams);
        } else {
            callback(selectableTeams.filter((team) => (
                team.name.toLowerCase().includes(term.toLowerCase()) ||
                    team.display_name.toLowerCase().includes(term.toLowerCase()) ||
                    team.id.toLowerCase() === term.toLowerCase()
            )));
        }
    };

    const radioPressed = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === 'enabled') {
            setEnabled(true);
        } else {
            props.onTeamsSelected([]);
            setEnabled(false);
        }
    };

    return (
        <>
            <RadioContainer>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='disabled'
                        checked={!enabled}
                        onChange={radioPressed}
                    />
                    {'Incident Collaboration enabled on every team.'}
                </RadioLabel>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='enabled'
                        checked={enabled}
                        onChange={radioPressed}
                    />
                    {'Incident Collaboration enabled on slected teams.'}
                </RadioLabel>
            </RadioContainer>
            {enabled &&
                <StyledAsyncSelect
                    isMulti={true}
                    cacheOptions={false}
                    defaultOptions={true}
                    loadOptions={loadTeams}
                    onChange={onChange}
                    getOptionValue={getOptionValue}
                    formatOptionLabel={formatOptionLabel}
                    isClearable={false}
                    value={props.teamsSlected.map(getTeamFromID)}
                />
            }
        </>
    );
};

interface SystemConsoleEnabledTeamsProps {
    id: string
    value?: string[]
    onChange: (id: string, value: string[]) => void
    setSaveNeeded: () => void
}

const SystemConsoleEnabledTeams: FC<SystemConsoleEnabledTeamsProps> = (props: SystemConsoleEnabledTeamsProps) => {
    const onTeamsSelected = (teams: string[]) => {
        props.onChange(props.id, teams);
        props.setSaveNeeded();
    };

    return (
        <TeamSelector
            onTeamsSelected={onTeamsSelected}
            teamsSlected={props.value || []}
        />
    );
};

export default SystemConsoleEnabledTeams;
