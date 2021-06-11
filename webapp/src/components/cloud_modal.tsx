import React from 'react';
import {useSelector} from 'react-redux';

import {isCloud} from 'src/license';

const CloudModal = () => {
    const isServerCloud = useSelector(isCloud);

    if (!isServerCloud) {
        return null;
    }

    // @ts-ignore
    const PurchaseModal = window.Components.PurchaseModal;

    return <PurchaseModal/>;
};

export default CloudModal;
