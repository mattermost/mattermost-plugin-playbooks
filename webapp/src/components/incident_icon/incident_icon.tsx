// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {RefObject} from 'react';

import classNames from 'classnames';

interface Props {
    isRHSOpen: boolean;
}

export default class IncidentIcon extends React.PureComponent<Props> {
    myRef: RefObject<HTMLElement>;

    constructor(props: Props) {
        super(props);
        this.myRef = React.createRef();
    }

    public render(): JSX.Element {
        const iconClass = classNames('icon', 'fa', 'fa-exclamation', {
            active: this.props.isRHSOpen,
        });

        // If it has been mounted, we know our parent is always a button.
        const parent = this.myRef.current ? this.myRef.current.parentNode as HTMLButtonElement : null;
        if (parent) {
            if (this.props.isRHSOpen) {
                parent.classList.add('active');
            } else {
                parent.classList.remove('active');
            }
        }

        return (
            <i
                ref={this.myRef}
                className={iconClass}
            />
        );
    }
}
