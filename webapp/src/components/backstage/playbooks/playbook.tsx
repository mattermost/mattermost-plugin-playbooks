// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Switch, Route, Redirect, Link, NavLink, useRouteMatch, useLocation} from 'react-router-dom';
import styled from 'styled-components';

import PlaybookBackstage from 'src/components/backstage/playbooks/playbook_backstage';
import {useExperimentalFeaturesEnabled} from 'src/hooks';

const Playbook = () => {
    const match = useRouteMatch();
    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();

    if (!experimentalFeaturesEnabled) {
        return <PlaybookBackstage/>;
    }

    const activeNavItemStyle = {
        color: 'var(--button-bg)',
        boxShadow: 'inset 0px -2px 0px 0px var(--button-bg)',
    };

    return (
        <>
            <Navbar>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/preview`}
                >{'Preview'}</NavItem>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/usage`}
                >{'Usage'}</NavItem>
            </Navbar>
            <Switch>
                <Route
                    exact={true}
                    path={`${match.path}`}
                >
                    <Redirect to={`${match.url}/preview`}/>
                </Route>
                <Route path={`${match.path}/preview`}>
                    <PlaybookBackstage/>
                </Route>
                <Route path={`${match.path}/usage`}>
                    <PlaybookBackstage/>
                </Route>
            </Switch>
        </>
    );
};

const Navbar = styled.nav`
    background: var(--center-channel-bg);
    height: 55px;
    width: 100%;
    box-shadow: inset 0px -1px 0px 0px rgba(var(--center-channel-color-rgb), 0.16);

    display: flex;
    flex-direction: row;
    padding-left: 80px;
    margin: 0;
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    text-align: center;
    padding: 0 25px;
    font-weight: 600;

    && {
        color: rgba(var(--center-channel-color-rgb), 0.64);

        :hover {
            color: var(--button-bg);
        }

       :hover, :focus {
            text-decoration: none;
        }
    }
`;

export default Playbook;
