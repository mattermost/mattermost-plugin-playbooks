// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {cloneElement, useState} from 'react';
import styled, {css} from 'styled-components';

import {
    useFloating,
    offset,
    flip,
    shift,
    autoUpdate,
    useInteractions,
    useClick,
    useRole,
    useDismiss,
    FloatingFocusManager,
    FloatingPortal,
    Placement,
} from '@floating-ui/react-dom-interactions';

const FloatingContainer = styled.div`
    min-width: 20rem;
	z-index: 50;

	.PlaybookRunProfileButton {
		.Profile {
			background-color: var(--button-bg-08);
		}
	}

    .playbook-run-user-select__menu-list {
        padding: 0 0 12px;
        border: none;
    }

    .playbook-run-user-select {
        border-radius: 4px;
        -webkit-overflow-scrolling: touch;
        background-color: var(--center-channel-bg);
        border: 1px solid var(--center-channel-color-16);
        max-height: 100%;
        max-width: 340px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
`;

type DropdownProps = {
    target: JSX.Element;
    children: React.ReactNode;
    placement?: Placement;
    offset?: Parameters<typeof offset>[0];
    flip?: Parameters<typeof flip>[0];
    shift?: Parameters<typeof shift>[0];
    initialFocus?: number;
    portal?: boolean;
    containerStyles?: ReturnType<typeof css>;
} & ({
    isOpen: boolean;
    onOpenChange: undefined | ((open: boolean) => void);
} | {
    isOpen?: never;
    onOpenChange?: (open: boolean) => void;
});

const Dropdown = (props: DropdownProps) => {
    const [isOpen, setIsOpen] = useState(props.isOpen);

    const open = props.isOpen ?? isOpen;

    const setOpen = (updatedOpen: boolean) => {
        props.onOpenChange?.(updatedOpen);
        setIsOpen(updatedOpen);
    };

    const {strategy, x, y, reference, floating, context} = useFloating<HTMLElement>({
        open,
        onOpenChange: setOpen,
        placement: props.placement ?? 'bottom-start',
        middleware: [offset(props.offset ?? 2), flip(props.flip), shift(props.shift ?? {padding: 2})],
        whileElementsMounted: autoUpdate,
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context, {enabled: props.isOpen === undefined}),
        useRole(context),
        useDismiss(context),
    ]);

    const MaybePortal = (props.portal ?? true) ? FloatingPortal : React.Fragment;

    return (
        <>
            {cloneElement(props.target, getReferenceProps({ref: reference, ...props.target.props}))}
            <MaybePortal>
                {open && (
                    <>
                        <FloatingFocusManager
                            context={context}
                            initialFocus={props.initialFocus}
                        >
                            <FloatingContainer
                                {...getFloatingProps({
                                    ref: floating,
                                    style: {
                                        position: strategy,
                                        top: y ?? 0,
                                        left: x ?? 0,
                                    },
                                })}
                                css={`
                                    ${props.containerStyles};
                                `}
                            >
                                {props.children}
                            </FloatingContainer>
                        </FloatingFocusManager>
                    </>
                )}
            </MaybePortal>
        </>
    );
};

export default Dropdown;
