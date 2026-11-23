// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    fallback: React.ReactNode;
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

// eslint-disable-next-line react/require-optimization
export default class EmbeddedErrorBoundary extends React.Component<Props, State> {
    state: State = {hasError: false};

    static getDerivedStateFromError(): State {
        return {hasError: true};
    }

    componentDidCatch(error: Error) {
        console.error('Embedded checklist failed to render:', error); // eslint-disable-line no-console
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}
