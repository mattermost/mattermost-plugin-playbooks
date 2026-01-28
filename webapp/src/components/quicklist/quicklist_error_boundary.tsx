// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Component, ErrorInfo, ReactNode} from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';

interface Props {
    children: ReactNode;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error boundary component for quicklist-related components.
 * Catches JavaScript errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 */
class QuicklistErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        // eslint-disable-next-line no-console
        console.error('QuicklistErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({hasError: false, error: null});
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <ErrorFallback data-testid='quicklist-error-boundary'>
                    <ErrorIcon className='icon-alert-circle-outline icon-32'/>
                    <ErrorTitle>
                        <FormattedMessage
                            defaultMessage='Something went wrong'
                        />
                    </ErrorTitle>
                    <ErrorDescription>
                        <FormattedMessage
                            defaultMessage='An error occurred while rendering this component. Please try again.'
                        />
                    </ErrorDescription>
                    <RetryButton
                        data-testid='quicklist-error-boundary-retry'
                        onClick={this.handleRetry}
                    >
                        <FormattedMessage
                            defaultMessage='Try Again'
                        />
                    </RetryButton>
                </ErrorFallback>
            );
        }

        return this.props.children;
    }
}

const ErrorFallback = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    gap: 12px;
`;

const ErrorIcon = styled.i`
    color: var(--error-text);
    font-size: 32px;
`;

const ErrorTitle = styled.h3`
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);
    margin: 0;
`;

const ErrorDescription = styled.p`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin: 0;
    max-width: 400px;
`;

const RetryButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    margin-top: 8px;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    color: var(--button-bg);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }
`;

export default QuicklistErrorBoundary;
