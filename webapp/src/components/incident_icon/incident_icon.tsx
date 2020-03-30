// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';

interface Props {
    rhsOpen: boolean;
}

export default class IncidentIcon extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const active = this.props.rhsOpen ? ' active' : '';

        return (<i className={'icon fa fa-exclamation' + active}/>);
    }
}
