// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {copyToClipboard} from 'src/utils';

import {CopyIcon} from '../playbook_runs/playbook_run_backstage/playbook_run_backstage';
import {OVERLAY_DELAY} from 'src/constants';
import Tooltip from 'src/components/widgets/tooltip';

type Props = {
    id: string;
    to: string;
} & ({
    name: string;
    tooltipMessage?: never
} | {
    name?: never;
    tooltipMessage: string;
});

const CopyLink = ({
    id,
    to,
    name,
    tooltipMessage,
}: Props) => {
    const {formatMessage} = useIntl();
    const [wasCopied, setWasCopied] = useState(false);

    const copyLink = () => {
        copyToClipboard(to);
        setWasCopied(true);
    };

    return (
        <Tooltip
            id={id}
            placement='bottom'
            delay={OVERLAY_DELAY}
            onExited={() => setWasCopied(false)}
            shouldUpdatePosition={true}
            content={wasCopied ? formatMessage({defaultMessage: 'Copied!'}) : (tooltipMessage ?? formatMessage({defaultMessage: "Copy link to ''{name}''"}, {name}))}
        >
            <AutoSizeCopyIcon
                className='icon-link-variant'
                onClick={copyLink}
                clicked={wasCopied}
            />
        </Tooltip>
    );
};

const AutoSizeCopyIcon = styled(CopyIcon)`
    font-size: inherit;
    display: inline-block;
`;

export default styled(CopyLink)``;
