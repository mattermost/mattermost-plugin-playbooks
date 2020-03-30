// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';

import classNames from 'classnames';

interface Props {
    isRHSOpen: boolean;
}

export default class IncidentIcon extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const iconClass = classNames('icon', 'fa', 'fa-exclamation', {
            active: this.props.isRHSOpen,
        });
        return (<i className={iconClass}/>);
    }
}
